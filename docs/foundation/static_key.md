## static_key

```json
"node" {
 "label": "static_key",
 "categories": ["foundation"],
 "info": "linux static_key jumtable",
 "depends": [
 ]
}
```

### 介绍

#### 背景介绍

我们都知道，现在主流的`CPU`都支持流水线机制，对应的就是指令预加载,但是代码中由于动态不确定的跳转可能会导致`预加载`的指令失效 ,我们一般称之为`branch miss` 

尤其是在热路径代码上，频繁的代码执行路径中, `if else` 语句会造成频繁的`branch miss`性能损失,  `likely/unlikely` 专门为此实现了优化, 可以参考， [c - How do the likely/unlikely macros in the Linux kernel work and what is their benefit? - Stack Overflow](https://stackoverflow.com/questions/109710/how-do-the-likely-unlikely-macros-in-the-linux-kernel-work-and-what-is-their-ben) ，核心就是通过修改编译后的汇编执行顺序(使用 `jne` or `je`?)，让可能性更高的分支 可以被`CPU` 利用提前预加载 加载(一旦进入意外情况，需要刷新流水线)；

`likely` 的机制实现比较简单，只需要告诉编译器哪个可能性更大或者更小，编译器会调整汇编指令，从而达到 总是 预加载 可能性更高的分支，从而降低`branch miss` 的概率 

但是，有另外一个场景，如果我们的代码如下

```c
bool log_open = false;

void enable_log(bool enable) {
    log_open = enable;
}

int func() {
    if (log_open) 
        do_something; 
}
```

如果`func`同样也是热路径，我们这里可能的情况会是： 

- `if(likely(log_open))` 只对`log_open=true`的情况友好，一旦`false` ,每次都是`branch miss` 反之亦然

上述情况通过简单调整汇编指令顺序已经无法解决，也就引入了本节内容，通过修改跳转指令地址达到我们要的功能

#### 资料参考

[官方介绍](https://www.kernel.org/doc/Documentation/static-keys.txt)

细节参考[jump label](https://blog.csdn.net/dog250/article/details/106715700)

### 用户态的一个实现

#### 示例代码

```c
// jump_label_demo.c
// gcc -DJUMP_LABEL -O jump_label_demo.c -o demo -g
#include <stdio.h>
#include <sys/mman.h>

#ifdef JUMP_LABEL
struct entry {
    unsigned long code;
    unsigned long target;
    unsigned long key;
};

#define MAX    2

struct entry base __attribute__ ((section ("__jump_table"))) = {0};
void update_branch(int key)
{
    int i;
    char *page;
    struct entry *e = (struct entry *)((char *)&base - MAX*sizeof(struct entry));

    for (i = 0; i < MAX; i++) {
        e = e + i;
        if (e->key == key) {
            // 修改代码段
            unsigned int *code = (int *)((char *)e->code + 1);
            unsigned int offset = (unsigned int)(e->target - e->code - 5);
            page = (char *)((unsigned long)code & 0xffffffffffff1000);
            mprotect((void *)page, 4096, PROT_WRITE|PROT_READ|PROT_EXEC);
            *code = offset;
            mprotect((void *)page, 4096, PROT_READ|PROT_EXEC);
            break;
        }
    }
}

#define STATIC_KEY_INITIAL_NOP ".byte 0xe9 \n\t .long 0\n\t"
static __attribute__((always_inline)) inline static_branch_true(int enty)
{
    int ent = enty;
    asm goto ("1:"
        STATIC_KEY_INITIAL_NOP
        ".pushsection __jump_table,  \"aw\" \n\t"
        // 定义三元组{本函数内联后标号1的地址,本函数内联后标号l_yes的地址,参数enty}
        ".quad 1b, %l[l_yes], %c0\n\t"  
        ".popsection \n\t"
        :
        : "i"(ent)
        :
        : l_yes);
    return 0;
l_yes:
    return 1;
}
#endif

int main(int argc, char **argv)
{
    int E1, E2;

    E1 = atoi(argv[1]);
    E2 = atoi(argv[2]);
#ifdef JUMP_LABEL
    int e1 = 0x11223344;
    int e2 = 0xaabbccdd;

    printf("Just Jump label\n");
    if (E1) {
        update_branch(e1);
    }
    if (E2) {
        update_branch(e2);
    }
#endif

#ifdef JUMP_LABEL
    if (static_branch_true(e1)) {
#else
    if (E1) {
#endif
        printf("condition 1 is true\n");
    } else {
        printf("condition 1 is false\n");
    }
#ifdef JUMP_LABEL
    if (static_branch_true(e2)) {
#else
    if (E2) {
#endif
        printf("condition 2 is true\n");
    } else {
        printf("condition 2 is false\n");
    }
    return 0;
}   这段代码中的 __jump_table  是在什么时候填充的？ 编译阶段？
```

#### 设计思想

本实现的核心设计思想在于 动态修改代码

如果最一开始代码编译结果为：

```asmatmel
do_something // func start
jmp l_false  // now defautl path is false
l_false:
   do_false // print condition 0 is false)
```

上面代码 函数无论如何都会走进`do_false`， 但是如果我们可以修改代码，当`true`生效 

```asm6502
do_something // func start
jmp l_true// now defautl path is false
l_false:
   do_false // print condition 0 is false)
l_true:
   do_true // print condition 1 is true)
```

要做到这样我们需要做什么？ 我们需要修改`jmp l_false -> jmp l_true`

如果我们只允许修改一次代码， 需要满足： 

- 要知道系统初始默认行为是什么(`jmp_false or  jmp_true`) 

- 需要知道要修改的代码地址： `code address of jmp_xxx`

- 需要知道修改的代码内容，如果默认行为是`jml_false` ,我们需要知道`jmp_ture`的地址

- 修改仅发生在第一次并且和默认行为不相同的时候，我们修改代码内容为`jmp_xxx`相反的`label`

#### 核心数据段： ____ jump_table

首先，我们在可执行程序中引入了一个叫做`jump_table`的数据段，当然，数据段内容现在我们可以自己定义 , 内容是一个`struct entry`数组

```c
struct entry {
    // 需要修改的代码 
    unsigned long code; 
    unsigned long target;
    unsigned long key;
};
```

数据段的内容填充是利用`asm goto` 实现的

#### 使能判断： key

内核为了能够让一个 `true/fasle` 对应使能多个`brach` 设计了 `key`

`key`用来记录分支是否使能 

```c
  struct static_key {                                                        
          atomic_t enabled;                                                  
  #ifdef CONFIG_JUMP_LABEL                                                   
  /*                                                                         
   * Note:                                                                   
   *   To make anonymous unions work with old compilers, the static          
   *   initialization of them requires brackets. This creates a dependency   
   *   on the order of the struct with the initializers. If any fields       
   *   are added, STATIC_KEY_INIT_TRUE and STATIC_KEY_INIT_FALSE may need    
   *   to be modified.                                                       
   *                                                                         
   * bit 0 => 1 if key is initially true                                     
   *          0 if initially false                                           
   * bit 1 => 1 if points to struct static_key_mod                           
   *          0 if points to struct jump_entry                               
   */                                                                        
          union {                                                            
                  unsigned long type;                                        
                  struct jump_entry *entries;                                
                  struct static_key_mod *next;                               
          };                                                                 
  #endif  /* CONFIG_JUMP_LABEL */                                            
  };     
```

同时，允许定义多个`entry` 映射到同一个`key`

```c
 struct jump_entry {                                                        
          s32 code;                                                          
          s32 target;                                                        
          long key;       // key may be far away from the core kernel under KASLR
  };   
```

这样，只要我们使能某个key，就可以遍历所有`entry`，找到 `key`关联的`entry`然后更新他的代码 

#### 分支更新

分支更新是根据起始状态的情况 动态决定是否需要更新的

### 内核主要接口和实现

#### 分支定义

```c
    DEFINE_STATIC_KEY_TRUE(key);
    DEFINE_STATIC_KEY_FALSE(key);
    DEFINE_STATIC_KEY_ARRAY_TRUE(keys, count);
    DEFINE_STATIC_KEY_ARRAY_FALSE(keys, count);
```

这些接口可以定义一个全局的`static_key`分支变量 不同点在于分支默认情况 

- `TRUE` ： 分支初始是使能状态，跳转类型为 `JUMP_TYPE_TRUE`

- `FALSE`:  分支初始是关闭状态，跳转类型为 `JUMP_TYPE_FALSE`

不同情况会影响接下来的 `jmp table` 跳转内容

#### 分支填充

在需要用到静态分支的地方使用如下接口，可以重复使用，每在一个地方使用一次，就会增加一个`entry`

```c
    static_branch_likely(&key)
    static_branch_unlikely(&key)
```

到这里需要解释一下 ，我们分情况看，如果`key`默认是`true`,并且配合`likely`使用

```c
DEFINE_STATIC_KEY_TRUE(key);

int func(){
    if (static_branch_likely(&key)) {
        printk("I am the true branch\n");
    }
}
```

`static_branch_xxxx` 接口会在`jmp_table`中存储跳转地址为相反的逻辑地址

`likely/unlikely`重点在于是否期望`预加载生效` 

```c
  * type\branch| likely (1)            | unlikely (0)                       
   * -----------+-----------------------+------------------                  
   *            |                       |                                    
   *  true (1)  |    ...                |    ...                             
   *            |    NOP                |    JMP L                           
   *            |    <br-stmts>         | 1: ...                             
   *            | L: ...                |                                    
   *            |                       |                                    
   *            |                       | L: <br-stmts>                      
   *            |                       |    jmp 1b                          
   *            |                       |                                    
   * -----------+-----------------------+------------------                  
   *            |                       |                                    
   *  false (0) |    ...                |    ...                             
   *            |    JMP L              |    NOP                             
   *            |    <br-stmts>         | 1: ...                             
   *            | L: ...                |                                    
   *            |                       |                                    
   *            |                       | L: <br-stmts>                      
   *            |                       |    jmp 1b                          
   *            |                       |                                    
   * -----------+-----------------------+------------------                  
   *                                                                         
   * The initial value is encoded in the LSB of static_key::entries,         
   * type: 0 = false, 1 = true.                                              
   *                                                                         
   * The branch type is encoded in the LSB of jump_entry::key,               
   * branch: 0 = unlikely, 1 = likely.                                       
   *                                                                         
   * This gives the following logic table:                                   
   *                                                                         
   *      enabled type    branch    instuction                               
   * -----------------------------+-----------                               
   *      0       0       0       | NOP                                      
   *      0       0       1       | JMP                                      
   *      0       1       0       | NOP                                      
   *      0       1       1       | JMP                                      
   *                                                                         
   *      1       0       0       | JMP                                      
   *      1       0       1       | NOP                                      
   *      1       1       0       | JMP                                      
   *      1       1       1       | NOP                                      
   *                                                                         
   * Which gives the following functions:                                    
   *                                                                         
   *   dynamic: instruction = enabled ^ branch                               
   *   static:  instruction = type ^ branch                                  
   *                                                                         
   * See jump_label_type() / jump_label_init_type().  
```

#### 分支使能

```c
static_branch_enable(&key);
static_branch_disable(&key);
static_branch_inc(&key);
static_branch_dec(&key);
```

可以通过`static_branch_xxx`接口完成分支使能或者关闭

#### 高级别接口：maybe

有些情况下，我们默认初始化`TRUE/FASLE` 可能会受`CONFIG`的影响 典型比如下面场景

```c
DECLARE_STATIC_KEY_MAYBE(CONFIG_INIT_ON_FREE_DEFAULT_ON, init_on_free);    

static_branch_maybe(CONFIG_INIT_ON_FREE_DEFAULT_ON,         
                                     &init_on_free);
```

这允许我们，在定义`key`时，可以根据配置选项 选择默认行为，并且在分支判断时 也会根据配置项 动态选择`likely` 或者是 `unlikely`
