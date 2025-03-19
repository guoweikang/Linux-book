## Alloc_flags

```json
node" {
    "label": "alloc_flags",
    "categories": ["mem"],
    "info": "alloc flags",
    "depends": [
        "gfp"
    ]
}
```

### 介绍

`budy` 内存分配器内部使用用于控制内存分配行为的标志为，外部不可见 ,定义如下

```c
 /* The ALLOC_WMARK bits are used as an index to zone->watermark */         
  #define ALLOC_WMARK_MIN         WMARK_MIN                                                                 
  #define ALLOC_WMARK_LOW         WMARK_LOW                                                                 
  #define ALLOC_WMARK_HIGH        WMARK_HIGH                                                                
  #define ALLOC_NO_WATERMARKS     0x04 /* don't check watermarks at all */   

  /* Mask to get the watermark bits */                                                                      
  #define ALLOC_WMARK_MASK        (ALLOC_NO_WATERMARKS-1)                    

  #define ALLOC_OOM               0x08                                                                      
  #define ALLOC_NON_BLOCK          0x10 /* Caller cannot block. Allow access 
                                         * to 25% of the min watermark or    
                                         * 62.5% if __GFP_HIGH is set.       
                                         */                                                                 
  #define ALLOC_MIN_RESERVE        0x20 /* __GFP_HIGH set. Allow access to 50%
                                         * of the min watermark.             
                                         */                                                                
  #define ALLOC_CPUSET             0x40 /* check for correct cpuset */       
  #define ALLOC_CMA                0x80 /* allow allocations from CMA areas */
  #ifdef CONFIG_ZONE_DMA32                                                                                  
  #define ALLOC_NOFRAGMENT        0x100 /* avoid mixing pageblock types */   
  #else                                                                                                     
  #define ALLOC_NOFRAGMENT        0x0                                                                     
  #endif                                                                                                    
  #define ALLOC_HIGHATOMIC        0x200 /* Allows access to MIGRATE_HIGHATOMIC */
  #define ALLOC_KSWAPD            0x800 /* allow waking of kswapd, __GFP_KSWAPD_RECLAIM set */
  /* Flags that allow allocations below the min watermark. */                                               
  #define ALLOC_RESERVES (ALLOC_NON_BLOCK|ALLOC_MIN_RESERVE|ALLOC_HIGHATOMIC|ALLOC_OOM)
```

- 前`3BIT` 标记 此次内存申请使用的水位线, 系统默认一开始使用  `ALLOC_WMARK_LOW`

- `ALLOC_OOM`: 标记此次内存申请是否触发`OOM`流程

- `ALLOC_NON_BLOCK`： 允许访问低于水位线`62.5%`的内存 

- `ALLOC_MIN_RESERVE`: 允许访问低于设置水位线的 `50%`  

### Alloc 设置和作用

#### __alloc_pages_noprof

在此接口中 初始默认设置为`ALLOC_WMARK_LOW`

```c
 struct page *__alloc_pages_noprof(gfp_t gfp, unsigned int order,           
  int preferred_nid, nodemask_t *nodemask)
  {                                                                          
          struct page *page;                                                 
          unsigned int alloc_flags = ALLOC_WMARK_LOW;   
```

根据`GFP` 是否设置了`__GFP_KSWAPD_RECLAIM` 决定是否设置 `ALLOC_KSWAPD`（唤醒内存回收任务)

```c
/*                                                                 
 * iis assumed to be the same as ALLOC_KSWAPD  
 * to save a branch.                                               
 */                                                                
alloc_flags = (__force int)(gfp_mask & __GFP_KSWAPD_RECLAIM);   
```

#### alloc_flags对功能的影响
