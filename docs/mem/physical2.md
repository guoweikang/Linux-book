## 物理内存页的组织

```json
"node" {
    "label": "page_manager",
    "categories": ["mem"],
    "info": "page manager",
    "depends": []
}
```

### 介绍

上一个小节 我们介绍了:  内存地址、`pfn`  , `page` 的互相映射关系，所以 内核分配物理页就是按照`vmemmap` 的布局管理和分配的吗？答案是并不是 

不同于我们习惯的资源管理,如果是正常的资源使用管理，我们会使用上面那种结构吗？并不会，在强调一次，上一个小节的内容，主要是为了说明 **内核为内存页表提供了一个机制，可以快速从内存和page之间数据转换** ，`struct page`是静态资源，对应于

### Node

在介绍`NUMA`模型，我们提到过，`NUMA`把不同的内存区域,根据 `CPU`的距离，按照`NODE` 进行了区分，因此，首先
内核根据物理内存的分布，应该把不同的物理内存在软件层面予以抽象，这个抽象就是 `struct pglist_data[NODE_NUM]`

访问不同`NODE`节点的`pglist_data`，通过`NODE_DATA(id)` 访问

```
extern struct pglist_data *node_data[];
#define NODE_DATA(nid)          (node_data[(nid)])
```

当然，如果你不支持`NUMA`，而是`UMP`模型，`contig_page_data` 是全局唯一的一个内存区 ，该方法被替换为

```
extern struct pglist_data contig_page_data;
static inline struct pglist_data *NODE_DATA(int nid)
{
        return &contig_page_data;
}
```

### ZONE

理想情况下，内存中的所有`页`从功能上讲都是等价的，都可以用于任何目的，但现实却并非如此，
例如一些DMA处理器只能访问固定范围内的地址空间 [参考](https://en.wikipedia.org/wiki/Direct_memory_access)

因此内核将整个内存地址空间划分成了不同的区，每个区叫着一个 Zone, 每个 Zone 都有自己的用途。

理解DMA的概念: 参考一些资料即可，介绍一下DMA解决什么问题，以及为什么DMA有内存访问的约束

[内核关于DMA 的介绍](https://docs.kernel.org/core-api/dma-api-howto.html)

请查询官网,看一下跟多关于ZONE的描述

### pglist_data

稀疏内存核心结构体: `struct pglist_data` 记录了每个 NUMA节点的内存布局，

内核以链表形式把所有`页`串联起来，这个结构在内核中抽象为`struct pglist_data` ，有了之前的基础，现在可以简单看一下 `pglist_data`的内容了

请查询官网,看一下跟多关于`pglist_data`的描述

[其他参考](https://www.kernel.org/doc/gorman/html/understand/understand005.html)

### 代码参考

内存分区和布局初始化路径为:

```
- start_kerenl 
 - setup_arch
  - bootmem_init 
   - zone_sizes_init // 根据系统的DMA限制范围(ACPI 设备树信息等) 得到系统的DMA 最大访问范围 
    - free_area_init // free_area_init: 初始化numa节点的内存布局结构 pglist_data 以及 zone data
       -  start_pfn = PHYS_PFN(memblock_start_of_DRAM()); // 系统真实物理地址的的起始PFN(去掉开头空洞) 
       -  end_pfn = max(max_zone_pfn[zone], start_pfn); // 获取每个zone的 PFN下限
       - free_area_init_node //初始化单个numa节点的 pg_data_t 和 zone data
         - calculate_node_totalpages  // 计算zone的实际大小 初始化numa 和 zone的 pfn范围 和 以及pages数量
         - free_area_init_core // 标记所有reserved 页帧 设置当前内存队列为空 清空所有内存标志位
           - pgdat_init_internals 
             - pgdat_init_split_queue // 初始化 pgdat 的 透明大页相关结构                 
             - pgdat_init_kcompactd //  初始化内存压缩列表
           -  pgdat->per_cpu_nodestats = &boot_nodestats; //初始化内存启动阶段的 内存使用情况统计
           -  memmap_pages = calc_memmap_size(size, freesize); 计算 页帧管理(PAGE)占用的内存 
```

总结: `free_area_init_node`: 会遍历所有pglist_data node 下的 所有zone，对一些基本字段完成初始化，
主要计算了 每个zone 的起始 FPN（node_start_pfn） ，以及在每个node有效的页帧数量(node_present_pages)，
会初始化 zone 的有效的页帧数量(present_pages)

`memap_init` 主要调用init_single_page 完成所有page的初始化工作

```
- memmap_init
    -  memmap_init_zone_range
           - memmap_init_range //初始化 物理页帧
```

### 示例参考

黑芝麻的 DMA range :

zone的初始化日志

```
[    0.000000] Zone ranges:
[    0.000000]   DMA      [mem 0x00000000 1800 0000 - 0x0000 0000 ffff ffff]
[    0.000000]   DMA32    empty
[    0.000000]   Normal   [mem 0x00000001 0000 0000 - 0x0000 0001 efff ffff]
[    0.000000] Movable zone start for each node
[    0.000000] Early memory node ranges
[    0.000000]   node   0: [mem 0x0000000018000000-0x00000000180fffff]
[    0.000000]   node   0: [mem 0x0000000080000000-0x000000008affffff]
[    0.000000]   node   0: [mem 0x000000008b000000-0x000000008cffffff]
[    0.000000]   node   0: [mem 0x000000008d000000-0x000000008fcfffff]
[    0.000000]   node   0: [mem 0x000000008fd00000-0x000000008fdfffff]
[    0.000000]   node   0: [mem 0x000000008fe00000-0x000000008febffff]
[    0.000000]   node   0: [mem 0x000000008fec0000-0x00000000b1ffffff]
[    0.000000]   node   0: [mem 0x00000000b2000000-0x00000000efffffff]
[    0.000000]   node   0: [mem 0x0000000198000000-0x00000001efffffff]
[    0.000000] mminit::memmap_init Initialising map node 0 zone 0 pfns 98304（18000000 >> 12） -> 1048576（ffff ffff >> 12） //对应DMA ZONE 
[    0.000000] mminit::memmap_init Initialising map node 0 zone 2 pfns 1048576(100000000 >> 12) -> 2031616（1 efff ffff >> 12） //对应NORMAL ZONE 
[    0.000000] On node 0 totalpages: 819456(3201M  对应所有memblock的mem)
```

## 物理内存分配

### buddy子系统

#### 算法原理

物理内存分配中，永远最令人头痛的就是连续物理内存分配，甚至于Linux内核专门为此研发出了很多特性 
比如大页内存，以及我们上面看到的为`DMA`服务的 `CMA`机制，还有内存重排；

为什么连续内存如此难以对付？如果把内存简单设计为一个数组，就像我们看到的`pfn`数组

我们此时明明还有内存，但是却无法申请出满足用户要求的内存

这时有一个可能的方案，把`app2`的内存进行内存交换，可以得到连续的2个内存页，没错，确实是一个方案，而且也是内核的
一个解决方案，但是请想一下，他的性能是有多么的差

因此内核通过对连续内存分配和释放提出了一个伙伴算法，他的原理其实很简单， [视频链接](https://www.youtube.com/watch?v=1pCC6pPAtio)

[图片解释](https://s3.shizhz.me/linux-mm/3.2-wu-li-nei-cun/3.2.4-buddy-system-huo-ban-xi-tong)

#### 核心结构

有了之前的概念，我们把内核对于 ZONE 和页表的关系画出来 这个图是基础

#### order

内核分配内存单位是以 `order`为单位 `order`的含义代表 2的幂次方

- order0：表示分配1个页
- order1：表示分配连续2个页
- order2：表示分配连续4个页，依次类推

是否发现一个问题，内核没有办法分配 3个连续内存页？ 为什么？内核之所以选择这样做，是因为内核使用的内存分配算法决定的

如果我们分配`order 2` 的内存页，就会从 对应的`free_list[2]` 中优先寻找是否有可以使用内存，当然，如果没有，则会从`order 3` 的内存中找(拆分为2个`order2`)的链表

#### 代码介绍

链表结构的初始化主要分为两部分，第一部分其实我们已经在之前提到过,

```
bootmem_init//还记得我们讲 section初始化吗 他也是在这里初始化的
 - zone_sizes_init //还记得我们讲 DMA初始化吗， 每个zone的大小计算，在这里完成 
  - free_area_init // 内存布局这里完成初始化
   - free_area_init_node //node内存布局这里完成
    - free_area_init_core
       -init_currently_empty_zone //这里会把 free_list 全部初始化为空链表
```

OK 此时，ZONE里面的可用内存 目前都是空，也就是如果有人申请内存，此时是不可能申请到的，那么是谁初始化的空闲链表?

还记得现在是谁在管理内存吗？ `memblock`,memblock只需要把他管理的内存，除了`reserved`的内存全部释放给buddy就可以了

```
start_kernel 
 - mm_init 
  - mem_init 
    - memblock_free_all 
     - __free_pages_memory 
      - memblock_free_pages(pfn_to_page(start), start, order); 
```

需要注意的有，我们在初始化`memmap`的时候，所有的`page`设置的迁移类型都为`MIGRATE_MOVABLE` 因此所有未在memblock标记为`reserved` 的内存 会被释放到 `MOVAABLE`的free_list

```
 static void __init memmap_init_zone_range(struct zone *zone,
                                            unsigned long start_pfn,
                                            unsigned long end_pfn,
                                            unsigned long *hole_pfn)
  {
          unsigned long zone_start_pfn = zone->zone_start_pfn;
          unsigned long zone_end_pfn = zone_start_pfn + zone->spanned_pages;
          int nid = zone_to_nid(zone), zone_id = zone_idx(zone);

          start_pfn = clamp(start_pfn, zone_start_pfn, zone_end_pfn);
          end_pfn = clamp(end_pfn, zone_start_pfn, zone_end_pfn);

          if (start_pfn >= end_pfn)
                  return;

          memmap_init_range(end_pfn - start_pfn, nid, zone_id, start_pfn,
                            zone_end_pfn, MEMINIT_EARLY, NULL, MIGRATE_MOVABLE);

          if (*hole_pfn < start_pfn)
                  init_unavailable_range(*hole_pfn, start_pfn, zone_id, nid);

          *hole_pfn = end_pfn;
  }
```

你以为这样就完了吗？不不不 还没有，让我们在看一下黑芝麻的内存

```
[    0.000000] Reserved memory: created DMA memory pool at 0x000000008b000000, size 32 MiB
[    0.000000] OF: reserved mem: initialized node bst_atf@8b000000, compatible id shared-dma-pool
[    0.000000] Reserved memory: created DMA memory pool at 0x000000008fec0000, size 0 MiB
[    0.000000] OF: reserved mem: initialized node bst_tee@8fec0000, compatible id shared-dma-pool
[    0.000000] Reserved memory: created DMA memory pool at 0x000000008ff00000, size 1 MiB
[    0.000000] OF: reserved mem: initialized node bstn_cma@8ff00000, compatible id shared-dma-pool
[    0.000000] Reserved memory: created DMA memory pool at 0x000000009a000000, size 32 MiB
[    0.000000] OF: reserved mem: initialized node bst_cv_cma@9a000000, compatible id shared-dma-pool
[    0.000000] Reserved memory: created DMA memory pool at 0x000000009c000000, size 16 MiB
[    0.000000] OF: reserved mem: initialized node vsp@0x9c000000, compatible id shared-dma-pool
[    0.000000] Reserved memory: created DMA memory pool at 0x00000000a1000000, size 16 MiB
[    0.000000] OF: reserved mem: initialized node bst_isp@0xa1000000, compatible id shared-dma-pool
[    0.000000] Reserved memory: created CMA memory pool at 0x00000000b2000000, size 864 MiB
[    0.000000] OF: reserved mem: initialized node coreip_pub_cma@0xb2000000, compatible id shared-dma-pool
[    0.000000] Reserved memory: created CMA memory pool at 0x00000000e8000000, size 8 MiB
[    0.000000] OF: reserved mem: initialized node noc_pmu@0xe8000000, compatible id shared-dma-pool
[    0.000000] Reserved memory: created CMA memory pool at 0x00000000e8800000, size 8 MiB
[    0.000000] OF: reserved mem: initialized node canfd@0xe8800000, compatible id shared-dma-pool
[    0.000000] Zone ranges:
[    0.000000]   DMA      [mem 0x0000000018000000-0x00000000ffffffff] // DMA ZONE 的范围
[    0.000000]   DMA32    empty
[    0.000000]   Normal   [mem 0x0000000100000000-0x00000001efffffff]  // NORMAL ZONE 的范围
[    0.000000] Movable zone start for each node
[    0.000000] Early memory node ranges
[    0.000000]   node   0: [mem 0x0000000018000000-0x00000000180fffff]
[    0.000000]   node   0: [mem 0x0000000080000000-0x000000008affffff] 
[    0.000000]   node   0: [mem 0x000000008b000000-0x000000008cffffff] 
[    0.000000]   node   0: [mem 0x000000008d000000-0x000000008fcfffff] 
[    0.000000]   node   0: [mem 0x000000008fd00000-0x000000008fdfffff]
[    0.000000]   node   0: [mem 0x000000008fe00000-0x000000008febffff]
[    0.000000]   node   0: [mem 0x000000008fec0000-0x00000000b1ffffff]
[    0.000000]   node   0: [mem 0x00000000b2000000-0x00000000efffffff] //reserved as CMA 

[    0.000000]   node   0: [mem 0x0000000198000000-0x00000001efffffff]
[    0.000000] cma: Reserved 128 MiB at 0x0000000083000000 - 0x000000008b000000  // CMA 预留的内存 reserved as CMA
```

我们可以看到，还有大量`DMA32`区域的内存被标记为`CMA reserved`,这些内存隐含有 `resuable`，因此这部分内存也应该被
释放到freelist使用 他的逻辑如下

```
 - kernel_init
   - kernel_init_freeable
     - do_basic_setup 
       - cma_init_reserved_areas
         -  cma_activate_area  
          - set_pageblock_migratetype(page, MIGRATE_CMA); //设置迁移类型为CMA 
          - __free_pages(page, pageblock_order);
```

#### 调试

从系统中查看zone的信息: `cat /proc/zoneinfo |grep cma`

```
Node 0, zone   DMA32 
  pages free     287494
        min      8391
        low      10488
        high     12585
        spanned  950272  = 空洞
        present  459008  = 存在的page数量
        managed  287941  = 被buddy接管的内存数量()
        cma      258048  = 1008Mib  =  864 + 8 + 8 + 128  符合我们的预期
        protection: (0, 0, 1343, 1343)
        start_pfn:           98304  = 起始PFN

Node 0, zone   Normal
  pages free     176546
        min      10040
        low      12550
        high     15060
        spanned  983040
        present  360448
        managed  343886
        cma      0
```

### 内存分配接口

#### __GFP

#### 分配准备

首先应该知道，在每个`NUMA node` 下面，都有一个 `node_zonelists`,这其实就是一个数组

```
/*
 * node_zonelists contains references to all zones in all nodes.
 * Generally the first zones will be references to this node's
 * node_zones.
 */
struct zonelist node_zonelists[MAX_ZONELISTS];
```

先说明，为什么需要他，在`NUMA`的情况下，内存节点是有亲和性的，但是总有可能 从亲和的`node` 无法申请出内存，因此
每个`node`又根据和其他`node`的距离，根据`当前node`，进行了排序，作为备用`fallback`内存，一旦自己的`node`内存
无法申请出，从**离自己**最近的node分配

当然，嵌入式场景下，一般不用考虑`NUMA`，只有一个`node` 因此不存在`fallback` 这一说

既然在非`NUMA`场景下，只有一个`NODE`,我们也知道 `NODE`下会又不同的`ZONE` ，因此在分配内存时，必须还要确定可以从
哪些`zone` 里面分配内存

```
#define GFP_ZONE_TABLE ( \
        (ZONE_NORMAL << 0 * GFP_ZONES_SHIFT)                                   \
        | (OPT_ZONE_DMA << ___GFP_DMA * GFP_ZONES_SHIFT)                       \
        | (OPT_ZONE_HIGHMEM << ___GFP_HIGHMEM * GFP_ZONES_SHIFT)               \
        | (OPT_ZONE_DMA32 << ___GFP_DMA32 * GFP_ZONES_SHIFT)                   \
        | (ZONE_NORMAL << ___GFP_MOVABLE * GFP_ZONES_SHIFT)                    \
        | (OPT_ZONE_DMA << (___GFP_MOVABLE | ___GFP_DMA) * GFP_ZONES_SHIFT)    \
        | (ZONE_MOVABLE << (___GFP_MOVABLE | ___GFP_HIGHMEM) * GFP_ZONES_SHIFT)\
        | (OPT_ZONE_DMA32 << (___GFP_MOVABLE | ___GFP_DMA32) * GFP_ZONES_SHIFT)\
)
```

`GFP_ZONE_TABLE` 规定了一个table， 规定了不同flags`__GFP_X` 对应的不同的内存区域

```
#define GFP_ZONEMASK    (__GFP_DMA|__GFP_HIGHMEM|__GFP_DMA32|__GFP_MOVABLE)

static inline enum zone_type gfp_zone(gfp_t flags)
{
        enum zone_type z;
        int bit = (__force int) (flags & GFP_ZONEMASK);
        z = (GFP_ZONE_TABLE >> (bit * GFP_ZONES_SHIFT)) &
                                         ((1 << GFP_ZONES_SHIFT) - 1);
        return z;
}
```

上述代码，首先 `GFP_ZONEMASK` 保证了只处理内存区域的为4种标识 然后对`GFP_ZONE_TABLE` 反向运算，可以得到最终可用的zone

举例说明：

- 如果用户没有指定zone(0)；则得到 `ZONE_NORMAL`
- 如果用户指定`___GFP_DMA`；则得到 `OPT_ZONE_DMA`
- 如果用户指定`___GFP_MOVABLE | ___GFP_DMA32`；则得到 `OPT_ZONE_DMA32`

GFP 和 分组有个对应关系

```
  #define GFP_MOVABLE_MASK (__GFP_RECLAIMABLE|__GFP_MOVABLE) 
  #define GFP_MOVABLE_SHIFT 3

  static inline int gfp_migratetype(const gfp_t gfp_flags)
  {                       
          VM_WARN_ON((gfp_flags & GFP_MOVABLE_MASK) == GFP_MOVABLE_MASK);
          BUILD_BUG_ON((1UL << GFP_MOVABLE_SHIFT) != ___GFP_MOVABLE);
          BUILD_BUG_ON((___GFP_MOVABLE >> GFP_MOVABLE_SHIFT) != MIGRATE_MOVABLE);
          BUILD_BUG_ON((___GFP_RECLAIMABLE >> GFP_MOVABLE_SHIFT) != MIGRATE_RECLAIMABLE);
          BUILD_BUG_ON(((___GFP_MOVABLE | ___GFP_RECLAIMABLE) >>
                        GFP_MOVABLE_SHIFT) != MIGRATE_HIGHATOMIC);

          if (unlikely(page_group_by_mobility_disabled))
                  return MIGRATE_UNMOVABLE;

          /* Group based on mobility */
          return (__force unsigned long)(gfp_flags & GFP_MOVABLE_MASK) >> GFP_MOVABLE_SHIFT;
  }    
```

从上述代码可以推出

- `___GFP_MOVABLE` 对应 `MIGRATE_MOVABLE`
- `___GFP_RECLAIMABLE` 对应 `MIGRATE_RECLAIMABLE`
- `___GFP_MOVABLE` | `___GFP_RECLAIMABLE` 对应 `MIGRATE_HIGHATOMIC
