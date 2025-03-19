## GFP

```json
node" {
    "label": "gfp",
    "categories": ["mem"],
    "info": "gfp description",
    "depends": [
        "buddy",
        "zone",
        "migrate_type",
    ]
}
```

### 介绍

#### 回顾

目前我们已经学习了

- 有关内存`node` `zone` 的分区

- `PCP` 优先

- `wmark` 水位线

- `migrage_type` 内存回收标记

在之前基础上，我们现在可以进入本小节内容，既然内存分配的情况和类型这么复杂，在进行内存申请 应该如何控制内存分配的行为？

- `numa`存在的话，应该从哪个`numa node`中分配？

- 是否支持从其他`node`中分配？

- 从哪个`zone`里面分配？

- 如何标记`migrate type`？

- 分配中间是否允许同步内存回收？

- ...

等等以上关于如何定制`page allocator`行为,如果体现在函数调用上，需要设计这样的接口

```c
struct *page alloc_pages(int order, int preferred_nid,zone_t zone, 
      int migrate_type, bool allow_reclaim)
```

#### 解决方法

每次增加新的功能都需要不断增加入参，因此，为了解决参数过于复杂的情况，提出了`GFP`

`GFP`形式上就是`bitflags` ，每一个`bit` 都有其含义， 在文件 `include/linux/gfp_types.h` 中定义

```c
 enum {                                                                     
          ___GFP_DMA_BIT,                                                    
          ___GFP_HIGHMEM_BIT,                                                
          ___GFP_DMA32_BIT,                                                  
          ___GFP_MOVABLE_BIT,                                                
          ___GFP_RECLAIMABLE_BIT,                                            
          ___GFP_HIGH_BIT,                                                   
          ___GFP_IO_BIT,                                                     
          ___GFP_FS_BIT,                                                     
          ___GFP_ZERO_BIT,                                                   
          ___GFP_UNUSED_BIT,      /* 0x200u unused */                        
          ___GFP_DIRECT_RECLAIM_BIT,                                         
          ___GFP_KSWAPD_RECLAIM_BIT,                                         
          ___GFP_WRITE_BIT,                                                  
          ___GFP_NOWARN_BIT,                                                 
          ___GFP_RETRY_MAYFAIL_BIT,                                          
          ___GFP_NOFAIL_BIT,                                                 
          ___GFP_NORETRY_BIT,                                                
          ___GFP_MEMALLOC_BIT,                                               
          ___GFP_COMP_BIT,                                                   
          ___GFP_NOMEMALLOC_BIT,                                             
          ___GFP_HARDWALL_BIT,
          ___GFP_THISNODE_BIT,                                               
          ___GFP_ACCOUNT_BIT,                                                
          ___GFP_ZEROTAGS_BIT,                                               
  #ifdef CONFIG_KASAN_HW_TAGS                                                
          ___GFP_SKIP_ZERO_BIT,                                              
          ___GFP_SKIP_KASAN_BIT,                                             
  #endif                                                                     
  #ifdef CONFIG_LOCKDEP                                                      
          ___GFP_NOLOCKDEP_BIT,                                              
  #endif                                                                     
  #ifdef CONFIG_SLAB_OBJ_EXT                                                 
          ___GFP_NO_OBJ_EXT_BIT,                                             
  #endif                                                                     
          ___GFP_LAST_BIT                                                    
  };  
```

### GFP Flags

本小节对`GFP_FLAGS` 中的主要字段以及对内存分配产生的行为做出一些说明

#### __GFP_THISNODE

在多`numa node`平台上， 内核在申请内存时，如果当前`node`申请不出内存，会按照距离远近从其他`node` 中申请内存，在每个`node pg_list` 中就会记录全局`node`的`zoneref list` ,`zonelists` 里面又分了两个域

- `ZONELIST_FALLBACK`: 按照距离当前`node` 距离，由远及近列出其他`node`的`zones`

- `ZONELIST_NOFALLBACK`: 不会包含其他`node` 的`zone`， 一旦指定了`__GFP_THISNODE`则不允许尝试在从其他`node`分配

```c
  struct zonelist node_zonelists[MAX_ZONELISTS];                     
```

 内核默认行为：选择`ZONELIST_FALLBACK` 作为内存备用申请池，可以从系统所有
 `node`中申请内存

如果不希望内核从其他`node`申请内存，可以通过指定`__GFP_THISNODE` 的方式，选择`ZONELIST_NOFALLBACK`作为内存备用池

#### ZONE

我们已经学习过 `zone`的含义，也知道一般基本的`ZONE` 主要就是`DMA(32)` `NORMAIL` `MOVABLE`等.

```c
  #define __GFP_DMA       ((__force gfp_t)___GFP_DMA)                        
  #define __GFP_HIGHMEM   ((__force gfp_t)___GFP_HIGHMEM)                    
  #define __GFP_DMA32     ((__force gfp_t)___GFP_DMA32)                      
  #define __GFP_MOVABLE   ((__force gfp_t)___GFP_MOVABLE)  /* ZONE_MOVABLE allowed */
  #define GFP_ZONEMASK    (__GFP_DMA|__GFP_HIGHMEM|__GFP_DMA32|__GFP_MOVABLE)
```

和`zone`相关的主要是上面4个`bit`，如果没有显示设置，则表示是`ZONE NORMAL` 

**zone bit不一定只能设置一个，是可以同时设置的 ,比如既可以指定 DMA 也可以指定 MOVABLE**  因此`4位bit`其实对应了一共`16`种组合, 如何对这些组合解释 获取对应的`zone`?  通过`gfp_zone`函数,会把这`16`种组合 最终都给到唯一的`zone type` ，因此，就需要有知道对应的映射关系，并完成这种映射关系的转换

通过`gfp_zone` 获得对应的`zone_type`；

```c
 static inline enum zone_type gfp_zone(gfp_t flags)                         
  {                                                                          
          enum zone_type z;  
          //  保留低4bit                                              
          int bit = (__force int) (flags & GFP_ZONEMASK);                    

          z = (GFP_ZONE_TABLE >> (bit * GFP_ZONES_SHIFT)) &                  
                                           ((1 << GFP_ZONES_SHIFT) - 1);     
          VM_BUG_ON((GFP_ZONE_BAD >> bit) & 1);                              
          return z;                                                          
  }                
```

这段代码不好理解，简单看一下上述逻辑，

系统当前可以支持的`zone`的最大数量是`8`，也就是最多需要`3 bit` 表示`8`个`zone`, `16`个组合我们给每个组合一个`zone type`，也就是`48bit` 就够了，此时`16`个组合代表数组下标，这个原理和`MMU MPIDR` 非常类似

关于`16`个组合对应的内存`zone` 见下表  

```c
 /*                                                                         
   * GFP_ZONE_TABLE is a word size bitstring that is used for looking up the 
   * zone to use given the lowest 4 bits of gfp_t. Entries are GFP_ZONES_SHIFT
   * bits long and there are 16 of them to cover all possible combinations of
   * __GFP_DMA, __GFP_DMA32, __GFP_MOVABLE and __GFP_HIGHMEM.                
   *                                                                         
   * The zone fallback order is MOVABLE=>HIGHMEM=>NORMAL=>DMA32=>DMA.        
   * But GFP_MOVABLE is not only a zone specifier but also an allocation     
   * policy. Therefore __GFP_MOVABLE plus another zone selector is valid.    
   * Only 1 bit of the lowest 3 bits (DMA,DMA32,HIGHMEM) can be set to "1".  
   *                                                                         
   *       bit       result                                                  
   *       =================                                                 
   *       0x0    => NORMAL                                                  
   *       0x1    => DMA or NORMAL                                           
   *       0x2    => HIGHMEM or NORMAL                                       
   *       0x3    => BAD (DMA+HIGHMEM)                                       
   *       0x4    => DMA32 or NORMAL                                         
   *       0x5    => BAD (DMA+DMA32)                                         
   *       0x6    => BAD (HIGHMEM+DMA32)                                     
   *       0x7    => BAD (HIGHMEM+DMA32+DMA)                                 
   *       0x8    => NORMAL (MOVABLE+0)                                  
   *       0x9    => DMA or NORMAL (MOVABLE+DMA)                             
   *       0xa    => MOVABLE (Movable is valid only if HIGHMEM is set too)   
   *       0xb    => BAD (MOVABLE+HIGHMEM+DMA)                               
   *       0xc    => DMA32 or NORMAL (MOVABLE+DMA32)                         
   *       0xd    => BAD (MOVABLE+DMA32+DMA)                                 
   *       0xe    => BAD (MOVABLE+DMA32+HIGHMEM)                             
   *       0xf    => BAD (MOVABLE+DMA32+HIGHMEM+DMA)                         
   *                                                                         
   * GFP_ZONES_SHIFT must be <= 2 on 32 bit platforms.                       
   */                      
```

上图可以很直观看到每个`bit`组合最终对应的`zone` 

- `BAD` 表示不允许的组合

- `MOVABLE_BIT` 单独使用不表示`zone`（而是代表`migrate_type`）, 只有在同时和`___GFP_HIGHMEM_BIT` 一起设置时才表示明确需要从`MOVABLE zone`中申请

- 如果系统中不存在对应的`zone`，会默认设置为`NORMAL`

我们还需要知道一点，那就是内核并不是指定特殊的唯一的`zone` 进行分配，`zone`的分配是允许从高到底分配的，我们之前已经在`wmark`章节中讲过

- 如果我们设置了`__GFP_DMA32`，表示我们需要分配32位以内的地址空间
- 如果我们设置了`MOVABLE`，表示我们可以申请`MOVABLE`以下的所有内存(如果高位`zone`内存不足的时候)

#### GFP MIGRATE

`GFP` 使用两个`bit` 给用户指定`migrate type`

- `___GFP_MOVABLE`: 指定内存是可以移动的 `MIGRATE_MOVABLE`类型

- `__GFP_RECLAIMABLE` : 指定申请的内存是可以回收的`MIGRATE_RECLAIMABLE`类型

- 什么都不指定。指定申请的内存是`MIGRATE_UNMOVEABLE` 类型

我们可以通过`gfp_migratetype` 从`gfp_t` 转为`migrate_type`

```c
  static inline int gfp_migratetype(const gfp_t gfp_flags)                   
  {                                                                          
      return (__force unsigned long)(gfp_flags & GFP_MOVABLE_MASK) >> GFP_MOVABLE_SHIFT;
  }      
```

!!! note

```
由于 `___GFP_MOVABLE` 单独使用表示指定了`migrate_movable`, 结合`HIGHMEM`
一起使用可以指定`MOVABLE_ZONE`，也就是 一旦制定了`MOVABLE_ZONE`，必然指定了
`migrate_movable`；因此`MOVABLE_ZONE` 其中只会有`migrate_movable`类型的内存
```

`MIGRATE_HIGHATOMIC`  的类型一般不由`migrate_type`的`GFP`指定

```c
                if (alloc_flags & ALLOC_HIGHATOMIC)                        
                          page = __rmqueue_smallest(zone, order, MIGRATE_HIGHATOMIC);
                  if (!page) {                                               
                          page = __rmqueue(zone, order, migratetype, alloc_flags);

                          /*                                                 
                           * If the allocation fails, allow OOM handling and 
                           * order-0 (atomic) allocs access to HIGHATOMIC    
                           * reserves as failing now is worse than failing a 
                           * high-order atomic allocation in the future.     
                           */                                                
                          if (!page && (alloc_flags & (ALLOC_OOM|ALLOC_NON_BLOCK)))
                                  page = __rmqueue_smallest(zone, order, MIGRATE_HIGHATOMIC);

                          if (!page) {                                       
                                  spin_unlock_irqrestore(&zone->lock, flags);
                                  return NULL;                               
                          }                                                  
                  }       
```

- `ALLOC_HIGHATOMIC` :`alloc_flags`满足条件才从`MIGRATE_HIGHATOMI` 申请

- `ALLOC_OOM|ALLOC_NONBLOCK` : 设置了该条件位 才允许从`MIGRATE_HIGHATOMI` 中申请

关于`alloc_flags`我们在下一个小节在讲，在这里只需要知道`alloc_flags` 是内存申请时，根据`GFP`标记及其他条件内核内存模块自己设置的标记位，不由用户控制

### RECLAIM

内存回收相关标记位，有`__GFP_DIRECT_RECLAIM` 和`__GFP_KSWAPD_RECLAIM`

- `__GFP_DIRECT_RECLAIM`: 是否允许在内存申请时，主动调用内存回收任务，一般都允许，但是在特别的模··块，比如申请内存的模块和回收模块有交集，可能触发死锁，又或者在某些上下文关注内存申请效率，希望缩短内存申请流程(但是可能会失败) 

- `__GFP_KSWAPD_RECLAIM`: 是否允许在内存申请时，主动唤醒内存回收线程，和上一个区分， 只表示是否允许唤醒，而不会自己去调用回收任务

- `__GFP_RECLAIM` : 上面两者的并集`___GFP_DIRECT_RECLAIM|___GFP_KSWAPD_RECLAIM`

!!! note

```
注意和`__GFP_RECLAIMABLE`区分，前者表示申请的内存是否可以回收，而后者表示是否允许在申请
过程中回收内存
```

#### WMARK

我们已经学习过水位线相关知识，内核在`GFP`中 提供了用户允许配置水位线的接口 分别为：

* `__GFP_HIGH` 表示调用者具有高优先级，例如，创建 IO 上下文以清除来自原子上下文的页面和请求。再分配内存时，会允许在内存已经低于水位线的时候，在下探一部分

* `__GFP_MEMALLOC` 不对水位线做限制。并且会跳过检查内存水位线 , 这只应在调用者保证分配将允许在很短的时间内释放更多内存时使用，例如进程退出或交换。用户应该 * 是 MM 或与 VM 密切协调（例如通过 NFS 交换）。在使用此标志之前，应始终考虑使用预分配池（例如 `mempool`）

* `__GFP_NOMEMALLOC`用于明确禁止访问紧急储备(`HIGHATOMIC`) 

如果都不设置的话 为一般情况， 表示没有任何特殊约束，由内存分配模块自己决定，内存分配时

#### GFP_IO/FS

**1 `__GFP_IO`（允许进行物理 I/O 操作）**

- 该标志表示**分配内存时可以触发物理 I/O 操作**（如磁盘读取或写入）。

- 当内核在申请内存时，如果当前系统内存不足，可能会尝试释放一些缓存页或交换出（swap out）某些页面，这些操作可能需要访问磁盘或其他 I/O 设备。

- 如果 **设置了 `__GFP_IO`**，那么内核可以进行这些 I/O 操作，从而有更大概率成功分配到内存。

- **如果 `__GFP_IO` 被清除（未设置）**，那么在内存紧张时，内核不会进行任何涉及磁盘 I/O 的操作，而是仅仅依靠已有的可用内存进行分配，这可能会导致分配失败或触发 OOM（Out of Memory）。
  
  **使用场景**

- 适用于 **非中断上下文** 的内存分配，比如 `GFP_KERNEL`，因为它们可以等待 I/O 操作完成。

- 在 `GFP_NOIO` 这样的模式下，它会被清除，以防止递归进入 I/O 操作（例如，在块设备驱动程序中，分配缓冲区时可能会产生新的 I/O 需求，导致死锁）。

---

 **2. `__GFP_FS`（允许调用文件系统相关函数）**

- 该标志表示**分配内存时可以调用低级文件系统（FS）相关函数**。

- 当内核需要回收内存时，可能会尝试释放 `dentry`（目录缓存）、`inode`（索引节点）等文件系统相关的对象，而释放这些对象通常需要文件系统代码的参与（如 `shrink_dcache_memory()` ）。

- **如果 `__GFP_FS` 被清除**，则分配器在回收内存时不会调用文件系统相关代码，从而避免可能的递归锁问题。

- 主要用于避免 **文件系统死锁**：
  
  - 例如，在某些情况下，文件系统的代码本身就需要申请内存，如果内存分配需要回调文件系统（而它已经持有锁），可能会导致死锁。
  
  **使用场景**

- 典型的 `GFP_KERNEL` 内存分配默认是 **允许 `__GFP_FS`** 的，因为一般情况下，内存分配时允许回收 `dentry` 和 `inode` 缓存。

- 但在某些 **持有文件系统锁** 的上下文（如 `GFP_NOFS`）下，`__GFP_FS` 会被清除，以防止递归进入文件系统代码，从而引发死锁。

#### GFP_HARDWALL

当用户态申请内存时，我们一般默认都是支持了`cgroup`，表示该任务只能申请`cgroup`内的资源，这会影响node 策略 我们通过`GFFP_HARDWALL` 表示此次内存申请只允许申请属于任务的内存内存 不允许跨其他node

#### __GFP_NOFAIL

内存申请必须成功 不许失败：调用者无法处理分配失败。分配可能会无限期阻塞，但绝不会返回失败。测试失败是没有意义的。

* 它必须可阻塞并与 `__GFP_DIRECT_RECLAIM` 一起使用。
* 它绝不应该在不可休眠的上下文中使用。
* 应仔细评估新用户（并且仅在没有合理的失败策略时才应使用该标志），但使用该标志绝对比围绕分配器进行无限循环重试更好
* 不支持使用 `__GFP_NOFAIL` 和 `order > 1` 从伙伴分配页面。请考虑改用 `kvmalloc()`

### ALLOC_FLAGS

上一个小节，我们看到了 内核提供给用户的`GFP` 标记，有些标记确实可以直接控制内核内存分配的行为,比如 `node/zone`的指定  但是还有一些行为，是内核内存模块根据`alloc_flgas` 自己内部的标记为决定分配行为的 

#### 定义

`GFP` 中提供提供了 和水位线 相关的三个标记位，但是我们学习过，内核真正检查水位线，是通过`zone`里面的 `wmark`做检查的 ，我们也已经知道 每个`zone` 有三条水位线`MIN/LOW/HIGH` ,实际内核选择使用哪个水位线 是内存模块根据不同情况自己调整的，内核内部设置主要通过下面的  `alloc_fllags` 

- `ALLOC_WMARK_MIN `:标识水位线从`wmark[MIN]`中读取，慢速路径的默认水位线

- `ALLOC_WMARK_LOW` :标识水位线从`wmark[LOW]`中读取, 快速路径选择此水位

- `ALLOC_WMARK_HIGH` :标识水位线从`wmark[HIGH]`中读取，`OOM` 路径选择此水位线

还有一些其他的定义

- `ALLOC_OOM`： 内核已经在OOM，代表内存压力很大

- `ALLOC_NON_BLOCK`：内存申请不允许`block` ，允许内存水位线下探最低水位线的 `62.5%`

- `ALLOC_MIN_RESERVE`: `GFP_HIGH`  会设置此标记位，允许内存水位线下探最低水位线的 `50%`

- `ALLOC_HIGHATOMIC`: 允许申请备用内存`MIGRATE_HIGHATOMIC`

- `ALLOC_KSWAPD`:`__GFP_KSWAPD_RECLAIM` 设置此标记

- `ALLOC_NOBLOCK`: 内存申请不允许阻塞，如果`GFP_DIRECT_CLAIM`不支持，并且用户没有明确设置`__GFP_NOMEMALLOC`(不允许使用紧急内存）,设置此标记位
