## 水位线监控

```json
node" {
    "label": "wmark",
    "categories": ["mem"],
    "info": "wmark ",
    "depends": [
        "zone"
    ]
}
```

### 基本介绍

如果我们假设内存可以任意分配， 我们假设这样一种场景，比如用户态或者内核态某个任务把内核全都申请完，那就必然会造成其他任务无法在申请到内存，这是显而易见的，往往此时我们需要触发`OOM`机制，或者是其他一些内存回收机制去释放一部分内存出来

但是如果内存回收机制此时也可能需要申请内存，会发生什么？**导致内存回收机制也失效**

因此，我们需要一个机制，用来为内存或者内核核心任务保底，保证这些最核心的任务在任何情况下都还可以申请到内存，从而提升系统的健壮性，这个机制我们叫`最低水位线` ，只所以叫最低水位线，是因为同样还有高水位线，高水位线常常用来做内存提前预警

内核在每个`zone`(一般指`ZONE_NORMAL/DMA`内核用到的`lowmem`,`ZONE_MOVABLE`和高端内存一般都是用户态专用的，不需要这个机制) 都设置了水位线  用于根据当前`zone`内存容量  决定是否依然可以继续申请内存以及是否需要触发回收

在没有特殊设置情况下， 如果内存低于水位线，会1触发内存回收然后重试

#### 查看水位线信息

```shell
cat /proc/zoneinfo
```

在每个`zone`的下面可以看到

```vim
Node 0, zone   Normal
  pages free     237674
        boost    0
        min      518    // 最低水位线  
        low      759    // 低水位线 
        high     1000   // 高水位线 
        promo    1241
        spanned  262144
        present  262144
        managed  241951
```

#### 内存回收

当内核再分配内存时 如果检测到当前内存低于某个阈值，可以决定是否选择触发内存回收

本节暂时还不会重点关注内存回收的细节 暂时仅需要知道有这个行为即可

### 内核实现

#### 核心变量：_watermark

每个`zone` 有一个数组，记录当前`zone`水位线的设定值

```c
 unsigned long _watermark[NR_WMARK];                                
```

此数组记录i了每个`zone` 的水位线值.水位线的类型和计算公式

`min_free_kbytes`:系统应该保留的最小空闲内存 ，我们也可以手动调整该值，参考`内存 debug`章节

```c
  /*                                                                         
   * Initialise min_free_kbytes.                                             
   *                                                                         
   * For small machines we want it small (128k min).  For large machines     
   * we want it large (256MB max).  But it is not linear, because network    
   * bandwidth does not increase linearly with machine size.  We use         
   *                                                                         
   *      min_free_kbytes = 4 * sqrt(lowmem_kbytes), for better accuracy:    
   *      min_free_kbytes = sqrt(lowmem_kbytes * 16)                         
   *                                                                         
   * which yields                                                            
   *                                                                         
   * 16MB:        512k                                                       
   * 32MB:        724k                                                       
   * 64MB:        1024k                                                      
   * 128MB:       1448k                                                      
   * 256MB:       2048k                                                      
   * 512MB:       2896k                                                      
   * 1024MB:      4096k                                                      
   * 2048MB:      5792k                                                      
   * 4096MB:      8192k                                                      
   * 8192MB:      11584k                                                     
   * 16384MB:     16384k                                                     
   */                       
```

`WMARK_MIN`： 最低水位线，该值的计算和 `min_free_kbytes`强关联 ，计算公式为

```c
ALL_MANAGED_PAGES: ZONE_DMA + ZONE_NORMAL系统管理的所有内存(不需要包含用户高端内存)
min_free_pages : min_free_kbytes / PER_PAGE_SIZE 
WMARK_MIN:  min_free_pages*(zone_managed_pages/ALL_MANAGED_PAGES)
```

每个`zone`的最小水位线很好理解， 根据`zone`所占所有内存的比例 乘以 `min_free_pages` 计算得到

还有`LOW/HIGH/PROMO` 他们都是基于`MIN`的值依次递增的，递增步长的计算方法为：

```c
//利用 watermark_scale_factor(默认10) 和当前zone的内存 计算得到步长
// managed_pages*scale/10000
scale =  mult_frac(zone_managed_pages(zone),watermark_scale_factor, 10000))
step= max_t(MIN >> 2, scale)
```

默认步长是当前管理内存的 `0.1%` 

更多有关水位线的设置方法 参考`内存 debug`章节

#### 核心变量 ： lowmem_reserve

在每个`zone`里面还有一个字段和水位线相关，那就是` lowmem_reserve`

最低水位线我们已经知道，通过设置一个系统最低内存阈值，保证系统在紧急情况下的内存申请，已经有了最低水位线 为什么还需要 `lowmem_reserve`

```c
/*                                                                 
 * We don't know if the memory that we're going to allocate will be
 * freeable or/and it will be released eventually, so to avoid totally
 * wasting several GB of ram we must reserve some of the lower zone
 * memory (otherwise we risk to run OOM on the lower zones despite 
 * there being tons of freeable ram on the higher zones).  This array is
 * recalculated at runtime if the sysctl_lowmem_reserve_ratio sysctl
 * changes.                                                        
*/                                                                
long lowmem_reserve[MAX_NR_ZONES];    
```

这里已经给出了注释，但是我们再来分析和解释一下背景，我们已经非常清楚内存被按照`zone`进行划分，我们在申请的时候，可以指定`zone`进行分配(参考`gfp章节`)  但是实际在申请内存时，如果某个`zone`的内存不足，内核会使用其他`zone`进行分配，当然并不是所有`zone`都可以互相申请，遵循以下原则 ，只允许从高到底分配

以我的系统举例，我有三个`zone`，从低到高依次为 `zone_dma -> zome_normal -> zone_moveable`  ，假如我指定从`zone_normal`分配，如果此时`zone_normal` 内存已经低于水位线，可以继续从`zone_dma`申请，如果我指定从`zone_dma`分配，如果此时`zone_dma` 内存已经低于水位线，也没有其他`zone`可以给我分配；因此只允许从比自己小的 `zone id`中申请 

那么这样就可能有这样一种情况，如果用户态代码选择从`zone_moveable`中申请内存，如果内存不足的情况之下，就会继续从`zone_normal/dma`中尝试申请，这样就可能导致出现高端内存侵占低端内存的情况，正常我们是允许这样申请的，内核在允许的条件上增加了一个限制，那就是 允许`zone` 配置一个`protection`阈值，表示当我自己的`zone`内存充足的情况下，才允许给其他`zone`分配内存，否则我自己都无法保证我的内存申请，也不能让其他`zone`申请

我们通过`lowmem_reserve`设置这样的保护机制，下面是每个`zone`的初始化逻辑

- 我们只需要设置比当前`zone idx`更大的保护阈值即可  (`j=i+1`)

- 每个`zone`需要预留的比例存放在 `sysctl_lowmem_reserve_ratio`

```c
  static void setup_per_zone_lowmem_reserve(void)                            
  {                                                                          
          struct pglist_data *pgdat;                                         
          enum zone_type i, j;                                               

          for_each_online_pgdat(pgdat) {                                     
                  for (i = 0; i < MAX_NR_ZONES - 1; i++) {                   
                          struct zone *zone = &pgdat->node_zones[i];         
                          int ratio = sysctl_lowmem_reserve_ratio[i];        
                          bool clear = !ratio || !zone_managed_pages(zone);  
                          unsigned long managed_pages = 0;                   

                          for (j = i + 1; j < MAX_NR_ZONES; j++) {           
                                  struct zone *upper_zone = &pgdat->node_zones[j];
                                  bool empty = !zone_managed_pages(upper_zone);

                                  managed_pages += zone_managed_pages(upper_zone);

                                  if (clear || empty)                        
                                          zone->lowmem_reserve[j] = 0;       
                                  else                                       
                                          zone->lowmem_reserve[j] = managed_pages / ratio;
                          }                                                  
                  }                                                          
          }                                                                  

          /* update totalreserve_pages */                                    
          calculate_totalreserve_pages();                                    
  }        
```

我们举例说明，假设我当前系统的`lowmem_radio`设置为 ：

```shell
# cat /proc/sys/vm/lowmem_reserve_ratio 
256   32    0

//分别代表： ZONE_DMA： 256  ZONE_NORMAL: 32  ZONE_MOVABLE: 0
```

在`zone_dma`中，`lowmem_reserve[DMA,NORMAL,MOVABLE] = [0, NORMAL_PAGES/256, (NORMAL_PAGES+MOVABLE_PAGS)/256]`

在`zone_normal`中，`lowmem_reserve[DMA,NORMAL,MOVABLE] = [0, 0, (MOVABLE_PAGS)/32]`

如何使用`lowmem_reserve`？ 

假如指定从`zone_normal`分配，如果此时`zone_normal` 内存已经低于水位线，从`zone_dma`申请时，`zone_dma` 会检查自己的内存是否 大于`NORMAL_PAGES/256` 

假如指定从`zone_movable`分配，如果此时`zone_movable` 内存已经低于水位线，从`zone_normal`申请时，`zone_normal` 会检查自己的内存是否大于`MOVABLE_PAGS/32`

#### 核心接口： __zone_watermark_ok

水位线检查的核心接口 ，此接口不仅检查`pages`数量，还会检查是否有`order`合适的连续内存

- 首先判断当前剩余内存是否已经低于水位线

- 水位线判断还会检查是否满足`lowmem_reserve`的条件

- 然后判断是否有大小合适的连续内存 可以申请

```c
 bool __zone_watermark_ok(struct zone *z, unsigned int order, unsigned long mark,
                           int highest_zoneidx, unsigned int alloc_flags,    
                           long free_pages)
```

- `z`: 待检查的`zone`

- `order` : 申请的`order`

- `mark` : 需要检查的水位线`pages num `

- `free_pages` : 当前`zone`空闲内存数量

- `alloc_flags`: 内存申请标志为 用于检查是否设置 水位线相关标志(`ALLOC_RESERVES`)

- `highest_zoneidx`: 用于读取`zone->lowmem_reserve的下标`
