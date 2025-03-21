## 引用计数

```json
"node" {
    "label": "refcount",
    "categories": ["foundation"],
    "info": "kernel refcount",
    "depends": [
        "atomic",
        "foundation"
    ]
}
```

### 背景介绍

首先要先解释一下引用计数：`refcnt`, 这是编程模型常用的一个概念，用于记录内存在某一个时刻被多少人使用，并在释放内存时,根据`refcnt == 0`来判断是否可以真的释放资源 ，下面是一个简单例子： 

模块管理一个内部对象(`object`), 该对象的申请和释放需要掉用模块接口`new/release_object`

```c
struct ListNode  {
    struct ListNode *next;
}


struct Object {
    struct ListNode node;
    int value;
}

struct ObjectList {
    struct MutexLock lock,
    struct ListNode *head;
}
struct ObjectList alloc_list = { INIT_LOCK, NULL};
struct Object* new_object() {
       struct Object obj = malloc(sizeof(struct Object));
       mutex_lock(&alloc_list.lock);
       LIST_ADD(alloc_list, obj);
       mutex_unlock(&alloc_list.lock);
       return obj;
}

void release_object(struct Object* obj) {
       mutex_lock(&alloc_list.lock);
       LIST_DEL(alloc_list, obj);
       mutex_unlock(&alloc_list.lock);
       free(obj);
}
```

上面是一段相当简单的代码，但是有一个非常严重的`bug`,  我们在`release_object`的时候，并不代表只有我们一个在使用该对象，如果该对象此时还有其他人在使用，会出现什么情况呢？

```c
int thread_a(struct Object* obj) {
    // do something 
    release_obj(obj);
}

int thread_b(struct Object* obj) {
    // do something, prevent double free we don't release
}

int main() {
   struct Object* obj =  new_object();
   pthread_create(thread_a, obj);
   pthread_create(thread_b, obj);
}
```

如果`thread_a` 先释放了对象，`thread_b`就会有`UAF`的问题

这个场景并不是数据竞争，只是还有人再使用或者持有某个资源的时候(并不等于再访问该资源)，其他人不能释放该资源的内存，否则后续使用会造成 `UAF(user after free)`,为了避免此问题，我们需要记录资源当前是否被其他人持有，这个计数我们叫`引用计数`

引用计数是用来表示 资源(对象) 是否有人在使用，保证资源不会被在有人使用的情况下被释放，保证资源是 **可访问的**(不等于是有效的)， 资源释放的动作需要当引用计数减为`0`之后，才能释放, 我们简单修改以下代码

```c
struct Object {
    struct ListNode node;
    int value;
    atomic_t: refcnt
}

struct ObjectList {
    struct MutexLock lock,
    struct ListNode *head;
}
struct ObjectList alloc_list = { INIT_LOCK, NULL};
struct Object* new_object() {
    struct Object obj = malloc(sizeof(struct Object));
    // init refcnt
    obj.refcnt = 1;
    mutex_lock(&alloc_list.lock);
    LIST_ADD(alloc_list, obj);
    mutex_unlock(&alloc_list.lock);
    return obj;
}

void release_object(struct Object* obj) {
    mutex_lock(&alloc_list.lock);
    LIST_DEL(alloc_list, obj);
    mutex_unlock(&alloc_list.lock);
    free(obj);
}

struct Object* get_object(struct Object* obj) {
    atomic_inc(obj.refcnt);
    return obj;
}

void put_object(struct Object* obj) {
    atomic_dec(obj.refcnt);
    if atomic_read(obj.refcnt) == 0 {
        release_object(obj)
    }
}
```

我们通过增加两个`get/put_object`接口 屏蔽掉`release_object`的直接调用

```c
int thread_a(struct Object* obj) {
    // do something 
}

int thread_b(struct Object* obj) {
    // do something, prevent double free we don't release
    pub_obj(obj);
}

int main() {
   struct Object* obja = new_object();
   struct Object* objb = get_object(obj);
   pthread_create(thread_a, obja);
   pthread_create(thread_b, objb);
   pub_obj(obja);
   pub_obj(objb);
}
```

!!! note

```
每次发生指针的copy，都应该增加引用计数 在指针生命周期结束后，递减引用计数，
RUST REFCNT 智能指针生动的实现了这个功能
```

### key struct

#### refcount_t

最底层的结构体，就是一个原子变量计数

```c
typedef struct refcount_struct {
    atomic_t refs;       
} refcount_t; 
```

### Key Api

#### REFCOUNT_INIT

静态初始化宏 `REFCOUNT_INIT`

```c
#define REFCOUNT_INIT(n)        { .refs = ATOMIC_INIT(n), }
```

#### refcount_set(read)

基本的读写接口

```c
  static inline void refcount_set(refcount_t *r, int n)
  {
          atomic_set(&r->refs, n);
  }
  static inline unsigned int refcount_read(const refcount_t *r)
  {
          return atomic_read(&r->refs);
  }
```

#### refcount_dec

基本的原子递减接口，递减时会提供 `release`内存屏障(保证之前的内存写操作都已经完成)

```c
static bool refcount_dec(refcount_t *r)
```

#### refcount_dec_and_test

一个经过封装的接口引用计数递减1 ，并且检查是否等于0，如果为`0` 返回真值 提供`releae` 内存屏障

```c
static bool refcount_dec_and_test(refcount_t *r)
```

优化前后对比

```c
void put_object(struct Object* obj) {
 refcount_dec(obj.refcnt);
 if refcount_read(obj.refcnt) == 0 {
     release_object(obj)
 }
}

void put_object(struct Object* obj) {
 if refcount_dec_and_test(obj.refcnt) {
     release_object(obj)
 }
}
```

为什么需要`release` 内存屏障，假设如果不支持`release`的内存屏障 

```c
struct Object* get_object(struct Object* obj) {
    atomic_inc(obj.refcnt);
    return obj;
}

void put_object(struct Object* obj) {
    if atomic_dec_and_test(obj.refcnt) {
        release_object(obj)
    }
}

int main() {
   struct Object* obja = new_object();
   // init enable is false
   obja.val = 10;
   put_obj(obj);
}
```

一旦`obja`的访存 如果被优化到释放内存之后，会可能造成`UAF`

因此 `refcount_dec` 会保证引用计数递减之前所有对内存的写入都已经完成。

#### refcount_inc

```c
 static inline void refcount_inc(refcount_t *r)
```

引用计数递增1 

#### refcount_inc_not_zero

只有在 引用计数不为`0`的时候才递增，如果执行成功 返回真值

```c
 static inline void refcount_inc_not_zero(refcount_t *r)
```

这个接口并不适合我们的例子 

```c
struct Object* get_object(struct Object* obj) {
    if refcount_inc_not_zero(obj.refcnt) {
        return obj;
    }

    return NULL;
}
```

如果我们这样使用，也就是会怀疑`obj`的引用计数可能是`0`,也就意味着此时`obj` 可能是一个已经释放的资源，也就是我们此时对所有`obj`的操作都是在访问一个野指针。

更为常见的使用场景应该是这样的,该引用计数和当前内存访问无关，仅用来作为资源计数，这种情况下 存在等于0的情况`arch/arm64/mm/context.c`

#### lock API

除了上述接口以外，还有一些支持锁的接口 这些接口只是我们之前接口进一步的封装

```c
bool refcount_dec_and_mutex_lock(refcount_t *r, struct mutex *lock) ;
bool refcount_dec_and_lock(refcount_t *r, spinlock_t *lock);
bool refcount_dec_and_lock_irqsave(refcount_t *r,                                     
                                    spinlock_t *lock,                                  
                                    unsigned long *flags);
```

下面是之前的实现

```c
void release_object(struct Object* obj) {
    mutex_lock(&alloc_list.lock);
    LIST_DEL(alloc_list, obj);
    mutex_unlock(&alloc_list.lock);
    free(obj);
}

void put_object(struct Object* obj) {
   if refcount_dec_and_test(obj.refcnt) {
     release_object(obj)
  }
}
```

进一步封装后

```c
void release_object(struct Object* obj) {
    LIST_DEL(alloc_list, obj);
    free(obj);
}

void put_object(struct Object* obj) {
   if refcount_dec_and_lock(obj.refcnt, &alloc_list.lock) {
        release_object(obj)
        mutex_unlock(&alloc_list.lock);
  }
}
```

下面有两种实现方法，第一个是内核的实现

```c
  bool refcount_dec_and_lock(refcount_t *r, spinlock_t *lock)                
  {                                                                          
          if (refcount_dec_not_one(r))                                       
                  return false;                                              

          spin_lock(lock);                                                   
          if (!refcount_dec_and_test(r)) {                                   
                  spin_unlock(lock);                                         
                  return false;                                              
          }                                                                  

          return true;                                                    
  }     



  bool refcount_dec_and_lock(refcount_t *r, spinlock_t *lock)                
  {                                                                                                                                              
          if (refcount_dec_and_test(r)) {                                   
                spin_lock(lock);                                               lock);                                         
                return true;                                              
          }                                                                                                                        
          return false;
  }                                                               
```

他们两个实现的区别在于 是否需要对 `引用计数` 和`资源释放` 一起保护起来；

在我们的用例中 是不需要保护的，那什么情况下需要呢？换句话说 需要保护原子计数递减，保护的意思就是会有并发竞争,我们看下面的例子

这个例子主要改变了`get_object`实现，不再基于一个有效的的`object`递增，而是从已有的链表上获取匹配的`object`，下面代码注释详细解释了为什么`refcnt`的变化需要被锁保护，解释了`refcount_dec_and_lock` 为什么需要把`refcnt`变化同步给锁住  

```c
struct Object {
    struct ListNode node;
    int value;
    refcnt_t: refcnt
}

struct ObjectList {
    struct MutexLock lock,
    struct ListNode *head;
}
struct ObjectList alloc_list = { INIT_LOCK, NULL};
struct Object* new_object() {
       struct Object obj = malloc(sizeof(struct Object));
       mutex_lock(&alloc_list.lock);
       LIST_ADD(alloc_list, obj);
       mutex_unlock(&alloc_list.lock);
       return obj;
}

struct Object* get_object(int val) {
    mutex_lock(&alloc_list.lock);
    for_each_object(alloc_list, obj) {
        if obj.val == val {
            // 必须放在锁里
            refcount_inc(obj.refcnt)
            mutex_unlock(&alloc_list.lock);
            // 如果不上锁的话，一旦解锁。obj可能是被其他人从链表上摘下去 可能已经被销毁
            // refcount_inc(obj.refcnt)
            return obj;
        }
    }
    return NULL;
}

void put_object(struct Object* obj) {
        //必须把引用计数放在锁里，如果不放在锁里面
        // 即使refcount_dec_and_test 成功，但是get_object依然可能递增引用计数
        // 导致检查无效
        mutex_lock(&alloc_list.lock);
        if refcount_dec_and_test(obj.refcnt) {
            // mutex_lock(&alloc_list.lock);
            LIST_DEL(alloc_list, obj);
            mutex_unlock(&alloc_list.lock);
            free(obj);
        }
}

void put_object2(struct Object* obj) {
        if refcount_dec_and_lock(obj.refcnt, &alloc_list.lock) {
            LIST_DEL(alloc_list, obj);
            mutex_unlock(&alloc_list.lock);
            free(obj);
        }
}
```

#### 饱和设计原则

##### 需求场景

 我们已经看到,`refcnt` 提供的接口本质上就是在对一个原子变量读写，内核在代码健壮性上实现了饱和设计, 我们依然还是先看一个实际场景。

```c
int funca() {
     struct Obj *obj = get_object();

     if (some_check_is_true) {
        // do something
        if (do_soemthing_is_error) {
              return 1;
        }   
     }
     put_obj(obj);
     return 0;
}

int funcb() {
     struct Obj *obj = get_object();
     if (some_check_is_true) {
        put_obj(obj);
     }
     put_obj(obj);
     return 0;
}
```

上面两段代码是典型的引用计数使用bug，但是又非常常见(忘记资源回滚)；健壮性的意思是在已经明知出现问题时，尽可能降低问题的影响范围，不要扩散

对于引用计数，最容易引起问题扩散的问题就是因为引用计数的不断溢出(上溢出和下溢出) 导致一个资源被不断的反复释放和申请

如果我们要保证不会出现溢出，我们应该怎么做？

```c
r = REFCOUNT_INIT(1)

task1: 
int old =  atomic_fetch_add(r); // old  shoud always > 0
// 可能发生了什么？
if old == 0 {
    // old = 0, 内存可能已经释放 , 继续使用内存，可能发生 UA
}

if old < 0  || old + i < 0  {
   // 隐含以下几种情况 
   // 原来的值 old < 0，
   // 原来的值 old>0,但是old + i < 0; 说明发生了溢出 可能发生内存泄漏
}

task2:
int old =  atomic_fetch_sub(r);
// 如果old < 1 说明发生了下溢
if old < 1 {
}
```

直接`panic`,还是打印告警？ 再生产环境，我们通常都是打印 日志即可，显而易见，仅仅通过打印日志，根本无法阻止问题，我们看一个这个场景： 

```c
refcont i = 1;
if refcount_dec_and_test(i) {
    free(mem)
}
```

考虑边界条件，就算是出问题了，但是 如果`refcont`反复再 临界区横跳，可能会进一步加剧问题(资源不断的申请 释放)，所以提出了饱和策略，他可以适当降低问题的进一步扩大；

当发生溢出时，把refcont 设置在一个距离溢出边界比较远，并且无效的值

已经知道，有符号数和无符号数的最大值

```
0 ----------------- 0x7fff_ffff -------------- 0xffff_ffff
                          <--------bad value! ------->
```

超过有符号数之后的值，我们都认为是无效的(**refcnt < 0** )

所以，当发生溢出时， 不断调整refcnt 为 下面的值

```c
REFCOUNT_SATURATED = INT_MIN / 2
```

这样，我们该引用计数关联的内存 不太可能出现被频繁释放和申请的情况，可以一直把 问题第一现场和内存固定
