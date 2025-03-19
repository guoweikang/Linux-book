## Kmemleak

```json
node" {
    "label": "kmemleak",
    "categories": ["mem"],
    "info": "kernel page alloc memleack detactor",
    "depends": [
            "stack_trace",
            "kmem_cache",
            "rcu"
    ]
}
```

[参考文章](https://www.eet-china.com/mp/a113356.html) 

这个博主对这个模块做了非常透彻的剖析 ，本文参考文章结合最新代码进行理解，如有侵权请告知

### 介绍

  内存泄漏是我们工作中经常遇到的问题，比如随着业务的持续运行，系统中可用内存在快速减少，导致某个重要的业务进程被`OOM kill`掉了。内存泄漏往往都是很严重的问题，尤其是内核态的内存泄漏，危害更大。每次泄漏一块内存，该块内存就成为一个黑洞，如果是严重的内核态内存泄漏，系统将很快变的无法正常使用，通常需要重启设备或者服务器才能解决问题。我们肯定不希望这种事情发生，那就需要想办法把内存泄漏提前暴露在测试环境中。要解决内存泄漏问题.

首先需要了解内存泄漏的特点。内存泄漏分为用户态的内存泄漏和内核态的内存泄漏，我们本文主要关注的是内核态的内存泄漏。工作中比较常见的内存泄漏按照发生泄漏的频率可以划分以下几种类型：

- 一次性内存泄漏，只在初始化过程中或某一次条件触发产生的内存泄漏。

- 偶发性内存泄漏，在某种条件下偶尔触发产生的内存泄漏。

- 频发性内存泄漏，内存泄漏点被频繁的触发。
  
  对于频发性内存泄漏我们有比较多的调试手段去定位，比如我们可以先通过`/proc/meminfo`信息大致确定下内存泄漏发生在哪个模块中，再通过其他手段进一步定位。如果观察到`vmalloc`异常，可以通过`/proc/vmallocinfo`信息分析定位。如果观察到`slab`内存异常，可以通过`slabinfo`和`/sys/kernel/slab/*/alloc_calls`或`free_calls`去辅助定位问题。而对于一次性的或者偶发性的内存泄漏确很难去通过`/proc/meminfo`信息快速分析定位，且大量的一次性或偶发性内存泄漏，同样给系统造成额外的内存压力。而本文介绍的`kmemleak`工具为各种类型的内存泄漏提供了一种检测方法。

#### 原理

`kmemleak`是检测内核空间的内存泄漏的调试工具。检测对象是`memblock_alloc`、`kmalloc`、`vmalloc`、`kmem_cache_alloc`等函数分配的内存块

该内存块由`struct kmemleak_object`来描述(简称为`object`)。`kmemleak`的实现原理非常简单，就是扫描内存是否存在被申请(检查)内存的指针引用

- 通过暴力扫描内存（假定内存中存放的都是指针，以ARM64为例，每次扫描8个字节)，如果找不到指向起始地址或者内存块任何位置的指针，则分配的内存块被认为是孤立的，这意味着内核可能无法将分配内存块的地址传递给释放函数，因此该内存块被视为内存泄漏。

- 在上述成立的条件下，如果内存里面的内容发生了变化(`crc`)，则不会被记录为内存泄漏(因为可能用户没有记录原始指针 但是也还可以修改

### 用户使用参考

#### Config

##### Kconfig

`CONFIG_DEBUG_KMEMLEAK` 是否启用功能

`CONFIG_DEBUG_KMEMLEAK_DEFAULT_OFF`  启动默认关闭功能

`CONFIG_DEBUG_KMEMLEAK_AUTO_SCAN` 启动自动创建 `scan_thread`

#### BOOTCONFIG

在 `CONFIG_DEBUG_KMEMLEAK_DEFAULT_OFF`开启后，`kmemleak`默认启动是关闭状态，必须通过`boot`启动参数开启这样可以保证即使`CONFIG_DEBUG_KMEMLEAK`开启，用户也有自己选择权力

```c
kmemleak=on/off
```

 通过`kmemleak.verbose=true/fasle`设置是否自动打印泄漏内存 一般关闭，主要通过`debugfs`访问

#### debugfs

用户交互文件位于`/sys/kernel/debug/kmemleak` 

```shell
mount -t debugfs none /sys/kernel/debug/
```

直接读取文件 会打印出扫描的泄漏内存信息 

##### commond:  stack

设置是否扫描任务栈内存

```shell
echo stack=off/on > /sys/kernel/debug/kmemleak
```

##### commond: scan

启动或停止 定时自动扫描任务

```shell
echo scan=off/on > /sys/kernel/debug/kmemleak
```

设置内存扫描间隔 单位为秒

```shell
echo scan=120 > /sys/kernel/debug/kmemleak
```

在不使用线程定时扫描任务时 可以手动触发单次扫描

```shell
echo scan > /sys/kernel/debug/kmemleak
```

##### commond: clear

标记泄露内存为`gray` ，之后已经扫描出来的泄漏内存不会在被扫描为泄漏内存

```shell
echo clear > /sys/kernel/debug/kmemleak
```

##### commond: dump

指定某个以申请`内存` 打印该`object` 内存引用相关信息 主要用于`kmemleak`debug 

```shell
echo dump=xxxx > /sys/kernel/debug/kmemleak
```

### 设计实现

#### 需要扫描的内存

在泄漏检查的原理中，我们介绍过，内核是通过扫描**系统内存**的内容然后判断内存值是否等等于申请内存的指针，判断是否有人引用了内存指针，因此就需要清楚哪些内存需要扫描

扫描系统中在使用的内存，内存中已经分配的内存其实也是我们要检测的内存(这里有点绕)

扫描没有经过内存分配，但是也有效的内存(`bss percpu`这些); 

- 代码段： 包括 `bss` `data` `ro_after_init` 这些数据段都可能会存放申请内存的指针，对应的是 全局变量 静态变量

- 线程栈： 线程栈对应的临时变量

- `percpu`: CPU 的数据段 

- `vmemap page`: 扫描当前处于使用状态的 `struct page`（注意不是`物理内存`，是`page`）这里存疑 感觉和`memblock`的分配有重叠（测试一下）

- `memblock`: 早期各个系统从`memblock`申请出的物理内存，这部分内存没有被记录在`slub` 分配器中

- 系统分配的其他内存 ，由于系统分配的内存自身会加到`kmemleak`的`object list`；所以还需要扫描当前`kmemleak`持有的`object`

#### struct  kmemleak_object

`struct kmemleak_object`描述一段通过`memblock_alloc`、`kmalloc`、`vmalloc`、`kmem_cache_alloc`等函数分配的内存块。

```c
  struct kmemleak_object {                                                   
          raw_spinlock_t lock;                                 
          unsigned int flags;   /* object status flags */          
          struct list_head object_list; // 挂载申请节点                                      
          struct list_head gray_list; //挂载灰色节点                                       
          struct rb_node rb_node;                                            
          struct rcu_head rcu;            /* object_list lockless traversal */
          /* object usage count; object freed when use_count == 0 */         
          atomic_t use_count;                                                
          unsigned int del_state;         /* deletion state */               
          unsigned long pointer;  //内存指针                                           
          size_t size;       //内存大小                                                
          /* pass surplus references to this pointer */                      
          unsigned long excess_ref;                                          
          /* minimum number of a pointers found before it is considered leak */
          int min_count;                                                     
          /* the total number of pointers found pointing to this object */   
          int count;                                                         
          /* checksum for detecting modified objects */                      
          u32 checksum;                                                      
          depot_stack_handle_t trace_handle;                                 
          /* memory ranges to be scanned inside an object (empty for all) */ 
          struct hlist_head area_list;                                       
          unsigned long jiffies;          /* creation timestamp */           
          pid_t pid;                      /* pid of the current task */      
          char comm[TASK_COMM_LEN];       /* executable name */              
  };  
```

`object flags` 用于 标记`object`的状态：

- `OBJECT_ALLOCATED`： 标记`object` 状态有效，配合引用计数使用，有一种情况可能是`object`  被删除，但是其他任务依然持有内存引用，需要标记`object` 是无效的 
- `OBJECT_REPORTED`： 第一次被标记为泄漏时 标记`object` reported
- `OBJECT_NO_SCAN`:  标记 `object`内存不会被扫描，除非确认此内存不包含其他内存的引用才可以设置
- `OBJECT_FULL_SCAN`:   标记扫描`object` 所有内存
- `OBJECT_PHYS`：  标记`object`是`memblock`申请的物理内存
- `OBJECT_PERCPU`： 标记`object` 是`percpu`内存段

`count`和`min_count`用来作为判断`object` 泄漏的判断依据

内存块·`object`)有3种颜色，分别为黑色、白色、灰色， 通过`count`和`min_count`区分不同颜色的object。  

- 黑色：`min_count = -1`: 比如代码段  
  
  - `object`内存不可能包含对其他内存的引用, 此内存块不需要扫描(被标记为`OBJECT_NO_SCAN`)。
  
  - `object`内存永远不会泄漏(`count > min_count` 总为真)

- 白色：  `count < min_count`，没有足够的引用指向这个内存，一轮扫描结束后被认为泄漏的内存块。

- **灰色**:   
  
  - `min_count = 0`，这段内存需要被扫描，但是永远不会泄漏(`count > min_count` 总为真)，如代码中主动标记`object`为灰色，防止误报（如`data`、`bss`、`ro_after_init`）
  
  - 一轮扫描后`count >= min_count`，对该`object`有足够的指针引用，认为不存在内存泄漏的内存块。

#### 核心的数据结构

`object`会被存放在多个数据结构中

- `object_list`: 无序的双向队列，主要用于一些基本的常规的遍历场景，比如循环打印被标记为泄漏的内存信息，扫描任务的准备工作(回复) ，在`object`申请时加如队列，删除时从队列摘除

- `RB_tree`:  有三个按照按照内存指针排序的红黑树，按照 普通内存、percpu、phys三个类型，把三个不同类型的`object` 存放在三个不同的红黑树，这样做的好处在`scan mem`时，加速内存内容和`object` 的匹配过程  （实际上现在`PHYS` 总是作为灰色内存，不需要检查是否泄漏）

- `mem_pool` : 预留的 固定大小的 （`CONFIG_DEBUG_KMEMLEAK_MEM_POO`） 的静态内存 ，用于再内存泄漏场景下可能没有足够内存和前期缺少内存机制的场景

- `mem_pool_free_list`:   对应`mempoll`内存释放的缓冲区

#### API : kmemleak_alloc(_percpu/phys)
