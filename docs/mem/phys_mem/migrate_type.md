## migrate type

```json
node" {
    "label": "migrate_type",
    "categories": ["mem"],
    "info": "buddy migrate_type",
    "depends": [
        "buddy",
        "zone"
    ]
}
```

### 介绍

#### 回顾

现在我们学习了

- `buddy`分配算法

- `PCP` 优先，降低锁竞争

- `wmark` 水位线的功能和作用

但是之前的学习中，我们有意忽略了一点，无论在`zone`还是`PCP`的 `order`空闲链表中， 都可以看到有一个`migrate_type`的字段，我们没有对他进行探讨，是因为改字段实际上主要是为了 帮助内存回收 用来区分 哪些内存是可以回收和移动的

我们现在还不会讲到`内存回收`，因此本小节主要还是一个简单介绍

#### migrate_type

`buddy allocator` 通过二分法保证尽可能减少了碎片内存

但是仍然不可避免当系统在长时间运行后，内存又开始变得离散，然后又导致无法分配得到连续内存；

为了解决这个问题，内存子系统实际上实现了非常多的回收和迁移机制；

要实现内存的回收和迁移，必须要解决几个问题： 

- 哪些内存可以迁移回收的： 一般内核分配的内存，由于线性映射的存在，都是不允许迁移的，但是用户态的内存可以通过修改页表重映射，都是可以迁移的

- 迁移回收的颗粒度：每次迁移回收应该按照多大的颗粒度进行迁移回收？太小的话 回收太频繁，太大的话，又不够灵活

为了解决上面两个问题，分别提出了：

`pageblock_order`:这个值定义了迁移回收的颗粒度

`migratetype` : 定义了每个连续`pageblock_order`大小的内存的迁移类型

### Migrate type

```c
 enum migratetype {                                                         
          MIGRATE_UNMOVABLE,                                                 
          MIGRATE_MOVABLE,                                                   
          MIGRATE_RECLAIMABLE,                                               
          MIGRATE_PCPTYPES,       /* the number of types on the pcp lists */ 
          MIGRATE_HIGHATOMIC = MIGRATE_PCPTYPES,                             
          MIGRATE_TYPES                                                      
  };            
```

#### 迁移回收类型

我们先看 前三个类型`MIGRATE_UNMOVABLE/MOVABLE/RECLAIMABLE`这三个类型都和内存回收相关

- `MIGRATE_UNMOVABLE`: 内核在申请内存时最常用的类型,表示内存不允许移动 不可以回收

- `MOVABLE` :  用户态应用程序申请内存最常用的类型，表示内存可以移动 修改映射关系，可以`swap`

- `RECLAIMABLE`:  `cache` 缓存机制(比如文件系统缓存) 最常用的类型，表示内存可以直接回收掉

并且这三个内存互相之间也有主备关系，这些内存在分配时是可以互相按照`pageblock_order`大小移动的，这种主备关系体现在：

```c
  /*                                                                         
   * This array describes the order lists are fallen back to when            
   * the free lists for the desirable migrate type are depleted              
   *                                                                         
   * The other migratetypes do not have fallbacks.                           
   */                                                                        
  static int fallbacks[MIGRATE_PCPTYPES][MIGRATE_PCPTYPES - 1] = {           
          [MIGRATE_UNMOVABLE]   = { MIGRATE_RECLAIMABLE, MIGRATE_MOVABLE   },
          [MIGRATE_MOVABLE]     = { MIGRATE_RECLAIMABLE, MIGRATE_UNMOVABLE },
          [MIGRATE_RECLAIMABLE] = { MIGRATE_UNMOVABLE,   MIGRATE_MOVABLE   },
  };                      
```

`buddy allocator`申请函数`__rmqueue`隐含了这个迁移过程

```c
 /*                                                                         
   * Do the hard work of removing an element from the buddy allocator.       
   * Call me with the zone->lock already held.                               
   */                                                                        
  static __always_inline struct page *                                       
  __rmqueue(struct zone *zone, unsigned int order, int migratetype,          
                                                  unsigned int alloc_flags)  
  {                                                                          
          struct page *page;                                                 

          page = __rmqueue_smallest(zone, order, migratetype);               
          if (unlikely(!page)) {                                             
                  if (alloc_flags & ALLOC_CMA)                               
                          page = __rmqueue_cma_fallback(zone, order);        

                  if (!page)                                                 
                          page = __rmqueue_fallback(zone, order, migratetype,
                                                    alloc_flags);            
          }                                                        
          return page;                                                       
  }
```

#### MIGRATE_HIGHATOMIC

这个类型要单独说明，他和刚才的几种类型不太一样，只所以划分出这个类型，依然还是为了解决系统长期运行可能会导致的内存碎片问题 具体背景可以查看 https://lwn.net/Articles/658081/ 

核心设计思想在于通过检测系统是否又高阶内存申请请求，如果有则移动已经申请成功的高阶内存类型为 `MIGRATE_HIGHATOMIC`, 保证系统后面依然可以申请到高阶内存，但是这种预留不是无限制的，不得超过管理内存的`1%` 

另外，如果低阶内存申请失败时，也可以从`MIGRATE_HIGHATOMIC` 高阶内存中移动一部分给低阶内存申请

系统初始阶段，`MIGRATE_HIGHATOMIC` 始终是空的，什么时候会触发移动，根据代码来看 需要满足：

```c
          if (!(gfp_mask & __GFP_DIRECT_RECLAIM)) {                          
                  /*                                                         
                   * Not worth trying to allocate harder for __GFP_NOMEMALLOC even
                   * if it can't schedule.                                   
                   */                                                        
                  if (!(gfp_mask & __GFP_NOMEMALLOC)) {                      
                          alloc_flags |= ALLOC_NON_BLOCK;                    

                          if (order > 0) {                                   
                                  pr_info("alloc with ALLOC_HIGHATOMIC\n");  
                                  alloc_flags |= ALLOC_HIGHATOMIC;           
                          }                                                  
                  }                                                          
```

- `__GFP_DIRECT_RECLAIM` : 不支持直接回收的上下文(其实隐含此次内存申请没有内存回收的机会，在内存不足的情况下 有很大概率会失败) 

- `order > 0` : 此次内存申请必须是高阶内存申请 

- ` __GFP_NOMEMALLOC`: 没有显示指出此次内存申请不允许申请紧急内存
