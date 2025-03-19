## PageAlloc

```json
node" {
    "label": "page alloc",
    "categories": ["mem"],
    "info": "page allloc",
    "depends": [
        "buddy",
        "zone",
        "migrate_type",
        "gfp"
    ]
}
```

### 内核实现

本章节，我们将尝试分析走读内核 `alloc_pages` 的核心接口，分析内存的核心逻辑

由于我们已经在前几个章节做了很多准备，其实只是把之前的内容给串一遍

#### 核心接口: __alloc_pages_noprof

内存分配的核心接口是

```c
  struct page *__alloc_pages_noprof(gfp_t gfp, unsigned int order,           
         int preferred_nid, nodemask_t *nodemask)
```

该接口一共就只有四个参数 都很容易理解：

- `gfp` : 用户指定的内存申请的标志位，我们已经讲过

- `order` : 申请的内存阶数

- `preferred_nid` : 当前内核申请的`node` 节点 

- `nodemask` : `node`屏蔽掩码 

该函数的核心逻辑 我们整理如下

```c
  struct page *__alloc_pages_noprof(gfp_t gfp, unsigned int order,                                          
                                        int preferred_nid, nodemask_t *nodemask)
  {                                                                                                         
          struct page *page;                                                                                
          unsigned int alloc_flags = ALLOC_WMARK_LOW;                                                       
          gfp_t alloc_gfp; /* The gfp_t that was actually used for allocation */                            
          struct alloc_context ac = { };                                                                    
                                                                                                      /*                                                                                                
           * Apply scoped allocation constraints. This is mainly about GFP_NOFS                             
           * resp. GFP_NOIO which has to be inherited for all allocation requests
           * from a particular context which has been marked by                                             
           * memalloc_no{fs,io}_{save,restore}. And PF_MEMALLOC_PIN which ensures                           
           * movable zones are not used during allocation.                   
           */                                                                                               
          gfp = current_gfp_context(gfp);                                    
          alloc_gfp = gfp;                                                                                  
          if (!prepare_alloc_pages(gfp, order, preferred_nid, nodemask, &ac,                                
                          &alloc_gfp, &alloc_flags))                                                        
                  return NULL;                                               

          /*                                                                                                
           * Forbid the first pass from falling back to types that fragment                                 
           * memory until all local zones are considered.                                                   
           */                                                                
          alloc_flags |= alloc_flags_nofragment(zonelist_zone(ac.preferred_zoneref), gfp);                  

          /* First allocation attempt */                                     
          page = get_page_from_freelist(alloc_gfp, order, alloc_flags, &ac);                                
          if (likely(page))                                                                                 
                  goto out;                                                  

          alloc_gfp = gfp;                                                                                  
          ac.spread_dirty_pages = false;                                                                    

          /*                                                                 
           * Restore the original nodemask if it was potentially replaced with
           * &cpuset_current_mems_allowed to optimize the fast-path attempt.                                
           */                                                                
          ac.nodemask = nodemask;                                                                           

          page = __alloc_pages_slowpath(alloc_gfp, order, &ac);                                             

          return page
  }                                                                  
```

该函数实现主要就完成了几个动作：

- 初始化内存申请上下文`alloc_context`

- 初始化和检查`gfp：current_gfp_context`，利用任务上的标志位 决定是否需要移除`IO/FS`支持

- 初始化`alloc_flags`

- 尝试通过 `get_page_from_freelist`  接口申请内存

- 尝试通过`__alloc_pages_slowpath` 接口申请内存

接下来 我们将详细分析两个内存分析接口

#### 第一次分配： get_page_from_freelist

`__alloc_pages_noprof` 第一次通过`get_page_from_freelist` 尝试分配内存，

我们首先要清楚第一次分配内存时， `GFP` 和  `alloc_flags`的状态，才可以进一步分析后续的函数可能行为

##### GFP初始化

`GFP` 基于用户传入的值 

- 需要首先经过 `current_gfp_context`的检查，通过判断当前任务设置的` PF_MEMALLOC` 标志位对 `GFP_IO/FS`标志进行检查清理 

- 根据系统是否已经存在了 `cpuset`   决定是否需要设置`__GFP_HARDWALL`

##### alloc context 初始化

`prepare_alloc_pages` 会利用`gfp` 完成内存申请上下文初始化包括： 

- 利用`gfp`完成`zone` 的配置

- 利用`gfp`完成`nodelist` 的配置

- 完成`nodemask` 的配置

- 利用`gfp`完成`migratetype` 的配置

##### alloc_flags

- 使用 `ALLOC_WMARK_LOW`水位线初始化(ps：意味着第一次申请时内存水位线需要高过`low`)

- 根据任务是否处于任务上下文，如果不是 需要设置`ALLOC_CPUSET`

- 利用`__GFP_KSWAPD_RECLAIM` 配置 决定是否设置`ALLOC_KSWAPD`

##### 分配逻辑

我们只保留了和第一次分配申请相关的代码

```c
static struct page *                                                       
  get_page_from_freelist(gfp_t gfp_mask, unsigned int order, int alloc_flags,
                                                  const struct alloc_context *ac)
  {                                                                          

  retry:                                                                     

          no_fallback = alloc_flags & ALLOC_NOFRAGMENT;                      
          z = ac->preferred_zoneref;                                         
          for_next_zone_zonelist_nodemask(zone, z, ac->highest_zoneidx,      
                                          ac->nodemask) {                    
                  struct page *page;                                         
                  unsigned long mark;                                        

                  mark = wmark_pages(zone, alloc_flags & ALLOC_WMARK_MASK);  
                  if (!zone_watermark_fast(zone, order, mark,                
                                         ac->highest_zoneidx, alloc_flags,   
                                         gfp_mask)) {                        
                          int ret;                                           

                          /* Checked here to keep the fast path fast */      
                          BUILD_BUG_ON(ALLOC_NO_WATERMARKS < NR_WMARK);      
                          if (alloc_flags & ALLOC_NO_WATERMARKS)             
                                  goto try_this_zone;                        


                          ret = node_reclaim(zone->zone_pgdat, gfp_mask, order);
                          switch (ret) {                                     
                          case NODE_RECLAIM_NOSCAN:                          
                                  /* did not scan */                         
                                  continue;                                  
                          case NODE_RECLAIM_FULL:                            
                                  /* scanned but unreclaimable */            
                                  continue;                                  
                          default:                                           
                                  /* did we reclaim enough */                
                                  if (zone_watermark_ok(zone, order, mark,   
                                          ac->highest_zoneidx, alloc_flags)) 
                                          goto try_this_zone;                

                                  continue;                                  
                          }                                                  
                  }                                                          

  try_this_zone:                                                             
                  page = rmqueue(zonelist_zone(ac->preferred_zoneref), zone, order,
                                  gfp_mask, alloc_flags, ac->migratetype);   
                  if (page) {                                                
                          prep_new_page(page, order, gfp_mask, alloc_flags); 
                          return page;                                       
                  }                                                          
          }                                                                                                                                                                               

          return NULL;                                                       
  }                                          
```

最主要的逻辑就是对水位线检查，然后尝试进行`node` 节点内存回收 然后再次申请

#### 第二次分配：__alloc_pages_slowpath

`__alloc_pages_noprof` 第一次通过`get_page_from_freelist` 分配内存如果失败，还会尝试第二次分配，第二次分配主要通过: `__alloc_pages_slowpath` 实现

和第一次内存申请最主要不同的地方在于： 

- 第一次申请的内存回收只会尝试`node` 节点内存之间回收。第二次申请会尝试执行更加复杂的内存回收动作，比如内存交换、压缩等; 如果在普通的非`NUMA`设备上，我们可以认为第一次的内存申请仅考虑了内存充足情况下的情况

- 第二次内存申请可能还会进行更加复杂的内存机制，比如`OOM`等

##### GFP初始化

`GFP` 基于用户传入的值

- 需要首先经过 `current_gfp_context`的检查，通过判断当前任务设置的 `PF_MEMALLOC` 标志位对 `GFP_IO/FS`标志进行检查清理

##### alloc_flags

- 水位线初始化： 使用 `ALLOC_WMARK_min`水位线初始化(ps：意味着第二次申请时内存水位线需要高过`min`，比第一次更低)

- `ALLOC_MIN_RESERVE`: `GPF_HIGH` 以及`RT任务` 可以申请更低水位线内存

- `ALLOC_KSWAPD`: 利用`__GFP_KSWAPD_RECLAIM` 配置

- `ALLOC_HIGHATOMIC` : `order >0` 并且不支持`DIRECT_RECLAIM` 并且没有显示设置`__GFP_NOMEMALLOC` 支持申请 `ATOMIC` 内存

- `ALLOC_NON_BLOCK`: 不支持`DIRECT_RECLAIM` 并且没有显示设置`__GFP_NOMEMALLOC` 则支持申请更低水位线 以及`ATOMIC`内存 

##### 分配逻辑

核心代码如下

```c
  __alloc_pages_slowpath(gfp_t gfp_mask, unsigned int order, struct alloc_context *ac)              

          if (alloc_flags & ALLOC_KSWAPD)                                                                   
                  wake_all_kswapds(order, gfp_mask, ac);                     

          /*                                                                                                
           * The adjusted alloc_flags might result in immediate success, so try
           * that first                                                      
           */                                                                
          page = get_page_from_freelist(gfp_mask, order, alloc_flags, ac);   
          if (page)                                                                                         
                  goto got_pg;  
```

- 唤醒`kswapd` 任务

- 由于降低了 `alloc_fallgs` 的水位线喷配置， 直接尝试重新再次分配内存

- 尝试`direct_reclaim` 直接回收内存

- 尝试`compact`内存压缩

- 
