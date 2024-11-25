## Fprobe

### 介绍

回顾上一个章节学习的内容： 

- `ftrace` 支持动态插桩

- 支持通过`register(unregister)_ftrace_function`   注册回调 

- 通过`traceops->hash`维护黑白函数名单，实现给指定函数实现插桩

`fprobe`属于`ftrace`的高级封装

- 回调函数更加简单，注册也更加简单
- 不仅仅支持函数入口回调，也支持函数返回回调(具体实现原理本章节会介绍)

### API使用示例

参考代码`samples/fprobe/fprobe_sample.c`

#### 注册和使能

首先准备`fprobe`注册结构体

```c
struct fprobe fp = {
       .entry_handler  = my_entry_callback,
       .exit_handler   = my_exit_callback,
};
```

然后调用`register_fprobe` 或者`register_fprobe_ips` 或者`register_fprobe_sym`

```c
//支持 通配符第一个是白名单，第二个是黑名单，表示注册所有的func* 函数 除了fun2c
register_fprobe(&fp, "func*", "func2"); 
```

```c
//按照dyn_trace中的ip函数地址注册
unsigned long ips[] = { 0x.... };

register_fprobe_ips(&fp, ips, ARRAY_SIZE(ips));
```

```c
//按照 sym符号注册
char syms[] = {"func1", "func2", "func3"};

register_fprobe_syms(&fp, syms, ARRAY_SIZE(syms));
```

取消注册可以使用

```c
unregister_fprobe(&fp)
```

`fprobe`支持软模式，就是回调会被注册，但是不会被执行

```c
enable_fprobe(&fp) 
disable_fprobe(&fp)
```

#### 回调函数

回调函数定义

```c
int entry_callback(struct fprobe *fp, unsigned long entry_ip, unsigned long ret_ip, struct pt_regs *regs, void *entry_data);

void exit_callback(struct fprobe *fp, unsigned long entry_ip, unsigned long ret_ip, struct pt_regs *regs, void *entry_data);
```

**注意，entry_ip 在函数入口处保存，并传递给退出处理程序。如果入口回调函数返回 !0，则相应的退出回调将被取消**

- `entry_ip` 这是跟踪函数的 ftrace 地址（包括入口和出口）。 请注意，这可能不是函数的实际入口地址，而是 ftrace 检测到的地址。

- `ret_ip` 这是跟踪函数将返回的返回地址，位于调用者的某处。 可在进入和退出时使用。

- `entry_data `这是一个本地存储空间，用于在入口和出口处理程序之间共享数据。 该存储空间默认为空。 如果用户在注册 `fprobe `时指定了` exit_handler `字段和 `entry_data_size `字段，存储空间将被分配并传递给 `entry_handler `和 `exit_handler`。

#### krpobe共享

仅作提示，`kprobe`我们还没有讲，讲完之后在回过头来理解

由于 `fprobe`的递归安全性与 `kprobes` 稍有不同，因此如果用户想从 `fprobe` 和 `kprobes` 运行相同的代码，这可能会造成问题。

`fprobe` 只使用 `ftrace_test_recursion_trylock()` （见 `fprobe_handler`）。 这允许中断上下文在` fprobe` 用户处理程序运行时调用另一个（或同一个）`fprobe`。

通过查看`ftrace_test_recursion_trylock`可以看到，允许中断递归

```c
-------------------------------------------------
int func() {
       fprobe_handler() -> 插桩                
       ...
       return 0;
}

void fprobe_handler() {
    fprobe_handler()  -> 插桩 ，递归不允许
}
-------------------------------------------------
int func() {
    fprobe_handler() -> 插桩
}

void fprobe_handler() {
      -------------------------->  中断发生   
                                   func()  
                                         fprobe_handler()-->  插桩 允许 
}
---------------------------------------------------------


 static void fprobe_handler(unsigned long ip, unsigned long parent_ip,
                  struct ftrace_ops *ops, struct ftrace_regs *fregs)
 {
          struct fprobe *fp;
          int bit;

          fp = container_of(ops, struct fprobe, ops); 
          if (fprobe_disabled(fp))
                  return;

          /* recursion detection has to go before any traceable function and
           * all functions before this point should be marked as notrace
           */
          bit = ftrace_test_recursion_trylock(ip, parent_ip);
          if (bit < 0) {
                  fp->nmissed++;
                  return;
          }
          __fprobe_handler(ip, parent_ip, ops, fregs);
          ftrace_test_recursion_unlock(bit);

  }
```

`kprobe`基于中断实现，检查递归是否发生使用 `percpu current_kprobe` 不区分 中断上下文，因此如果 `fprobe handler`希望被 `kprobe`共享，需要显示设置 ；

一旦设置之后，`ftrace handler`会额外检查 `current_kprobe` 

```c
//设置方式
fprobe.flags = FPROBE_FL_KPROBE_SHARED;
register_fprobe(&fprobe, "func*", NULL);


// 根据是否设置共享标志，使用不同的probe handler
  static void fprobe_init(struct fprobe *fp)
  {       
          fp->nmissed = 0;
          if (fprobe_shared_with_kprobes(fp))
                  fp->ops.func = fprobe_kprobe_handler;
          else
                  fp->ops.func = fprobe_handler;
          fp->ops.flags |= FTRACE_OPS_FL_SAVE_REGS;
 }
```

#### missed counter

再`fprobe`字段种还有一个`nmissed`字段，该字段会统计

- 由于递归导致的`handler`失败

- 由于`rethook`设置导致的失败 (原理会讲)

### 实现原理

#### fprobe结构体

```c
 struct fprobe {
  #ifdef CONFIG_FUNCTION_TRACER
          /*
           * If CONFIG_FUNCTION_TRACER is not set, CONFIG_FPROBE is disabled too.
           * But user of fprobe may keep embedding the struct fprobe on their own
           * code. To avoid build error, this will keep the fprobe data structure
           * defined here, but remove ftrace_ops data structure.
           */     
          struct ftrace_ops       ops;
  #endif  
          unsigned long           nmissed;
          unsigned int            flags;
          struct rethook          *rethook;
          size_t                  entry_data_size;
          int                     nr_maxactive;

          int (*entry_handler)(struct fprobe *fp, unsigned long entry_ip,
                               unsigned long ret_ip, struct pt_regs *regs,
                               void *entry_data);
          void (*exit_handler)(struct fprobe *fp, unsigned long entry_ip,
                               unsigned long ret_ip, struct pt_regs *regs,

 void *entry_data);
```

需要注意的有：

- `ftrace_ops`: `ftrace` 真正注册使用的结构体

- `rethook`: 存放函数返回地址信息

#### fprobe 注册

通过观察`register_fprobe`实现，

```c
register_fprobe 
 -> fprobe_init(fp); 
   -> fp->ops.func = fprobe_（kprobe)_handler;
 -> ftrace_set_filter
 -> fprobe_init_rethook
 -> register_ftrace_function(&fp->ops)
```

主要逻辑在于初始化`frrace_ops` 然后注册`ftrace` 

#### common  __fprobe_handler

通过上一个小节注册过程的梳理，看到公共的`fprobe_handler`函数被注册为不同`fprobe`的`ftrace_ops.func`，在该函数中，会掉用不同`fprobe`的实际的`entry_handler`

```c
  static inline void __fprobe_handler(unsigned long ip, unsigned long parent_ip,
                          struct ftrace_ops *ops, struct ftrace_regs *fregs)
  {               
         ....
          fp = container_of(ops, struct fprobe, ops);

          if (fp->entry_handler)
                  ret = fp->entry_handler(fp, ip, parent_ip, ftrace_get_regs(fregs), entry_data);

         ....
  }
```

#### 如何实现Exit handler

在`ftrace`章节，我们已经知道，打桩是通过再函数开始预留指令位置，然后实现插桩，那怎么样才可以实现返回时回调呢？ 

```c
func_a(){
    int a = 0;
    func_b(a) {
         entry_handler ----> 插桩
         if a = 0 {
             exit_handler ----> 插桩
             return 0;
         }else  {
             exit_handler -----> 插桩
             return 1;
         }
     }
     printf("end");
}
```

如果这样看，我们会看到 需要在两个不同的地方插桩，几乎无法实现，如果你对汇编熟悉的话，从 `func_b` 返回到 `func_a` ，是怎么样知道返回地址的？

答案就是`LR寄存器` 或者`栈` ，比如 `funcb` 返回地址为`printf(end)` 

那我是否可以 在 **entry_handler** 中修改`LR寄存器` ，把地址修改为`exit_handler`? 然后`exit_handler` 里面再恢复 `LR`为 `printfo（end）`？ 这就是我们要说的`rethook`机制 

`fprobe`中有一个`rethook`  ，用于维护`rethook_node` 池子

**Q: 为什么需要一个池子？** 

**A： fprobe 可以注册再多个 func里面，不同CPU 不同func触发call back时，都需要保存返回地址，池化可以解决部分问题** 

```c
struct fprobe {
      ...
      struct rethook   *rethook;
      ...
}
/**
   * struct rethook - The rethook management data structure.
   * @data: The user-defined data storage.
   * @handler: The user-defined return hook handler.
   * @pool: The pool of struct rethook_node.
   * @ref: The reference counter.
   * @rcu: The rcu_head for deferred freeing.
   *              
   * Don't embed to another data structure, because this is a self-destructive
   * data structure when all rethook_node are freed.
   */     
  struct rethook {
          void                    *data;
          /*      
           * To avoid sparse warnings, this uses a raw function pointer with
           * __rcu, instead of rethook_handler_t. But this must be same as
           * rethook_handler_t.
           */             
          void (__rcu *handler) (struct rethook_node *, void *, unsigned long, struct pt_regs *);
          struct freelist_head    pool;
          refcount_t              ref;
          struct rcu_head         rcu;
  }; 
```

`rethook`初始化发生在 `fprobe`注册流程里 

```c
register_fprobe()
  -> fprobe_init_rethook()
      fp->rethook = rethook_alloc((void *)fp, fprobe_exit_handler);
          if (!fp->rethook)
                  return -ENOMEM;
          for (i = 0; i < size; i++) {
                  struct fprobe_rethook_node *node;
                  node = kzalloc(sizeof(*node) + fp->entry_data_size, GFP_KERNEL);
                  if (!node) {
                          rethook_free(fp->rethook);
                          fp->rethook = NULL;
                          return -ENOMEM;
                  }
                  rethook_add_node(fp->rethook, &node->node);
```

`rethook`初始化后为: 

```c
struct rethook {
          void *data = fprobe;
          void __rcu *handler  = fprobe_exit_handler;
          struct freelist_head    pool = size * empty rethook_node；  
          refcount_t              ref;
          struct rcu_head         rcu;
  }; 
```

那么真正的 `LR`替换在哪里? 再 `fprobe_handler`里面

```c
__fprobe_handler()
       // 获取池子里面的node然后 初始化为当前上下文使用 
       // 保存ip，保存ret ip， 保存data
         if (fp->exit_handler) {
                  rh = rethook_try_get(fp->rethook);
                  if (!rh) {
                          fp->nmissed++;
                          return;
                  }
                  fpr = container_of(rh, struct fprobe_rethook_node, node);
                  fpr->entry_ip = ip;
                  fpr->entry_parent_ip = parent_ip;
                  if (fp->entry_data_size)
                          entry_data = fpr->data;
          }
        //设置跳板
         if (rh) {
               rethook_hook(rh, ftrace_get_regs(fregs), true);
         }


  void rethook_hook(struct rethook_node *node, struct pt_regs *regs, bool mcount)
  {
          arch_rethook_prepare(node, regs, mcount);
          __llist_add(&node->llist, &current->rethooks);
  }
```

`arch_rethook_prepare`  需要不同体系架构实现 ,arm还没有实现，我们看一下X86平台

```c
  void arch_rethook_prepare(struct rethook_node *rh, struct pt_regs *regs, bool mcount)
  { 
          unsigned long *stack = (unsigned long *)regs->sp;

          //保存entry_handler函数调用之前的 返回地址
          rh->ret_addr = stack[0];        
          //保存entry_handler函数调用之前的 栈
          rh->frame = regs->sp;

          //重置entry_handler函数调用之前的 返回地址
          stack[0] = (unsigned long) arch_rethook_trampoline
  ;
  } 
```

最终回到`rethook_trampoline_handler` 调用`exit handler`  并修正`LR`

#### 支持架构

目前 支持`RETHOOK`的架构 有

- x86

- riscv

- loongarch

- [arm64](https://lore.kernel.org/bpf/164338038439.2429999.17564843625400931820.stgit@devnote2/)
