## Zone

```json
node" {
    "label": "zone",
    "categories": ["mem"],
    "info": "mem zone",
    "depends": [
        "page",
        "memblock"，
        "sparse"   
    ]
}
```

### 介绍

#### 回顾

- 内存前期通过`memblock`管理内存分配

- 内核建立了 `sparse`   模型，系统的可用物理内存都申请了对应的`page`  

- 通过`vmemap` 在 `page VA` `page PA` 建立映射关系  简化`pfn_to_page` 

- 内核所有的物理地址 都有对应的`PFN`与之一一对应，每个`PFN`都可以通过`pfn_to_page` 获得对应管理该物理内存的`page`

内核不会一直使用`memblock`机制管理物理内存， 内核实际上是以`page`为单位管理物理内存，我们虽然在`sparse`给物理内存都申请了`page` ，但是`sparse`严格意义上不算是管理物理内存的机制，仅仅是用来负责存储`page`的结构，从本节开始，我们开始真正开始分析内核是如何分配管理物理内存的

!!! note

    再强调一次：sparse是用来存储所有物理内存page的结构，并不能用来管理page(每个struct page)
    可能已经分配，也可能没有分配). 因此仍然需要一个外部管理结构，专门负责管理使用的内存page

考虑到内存分配，内核主要通过`free list` (空闲未分配内存链表）管理内存分配，一开始所有空闲的内存都会被添加到该链表上，每次分配，从链表上摘取，释放则再挂载到链表上，链表上只记录`page`的指针，`page`实际物理内存再`sparese vmemmap`之中 

#### free list

上一个小节,我们说`空闲内存page`会挂在`freelist`上面，实际情况是，内核又根据内存的不同属性，对`freelist` 进行了分类，从大到小依次是： 

- `node`: 根据实际`CPU` 的`numa`设计，不同`CPU`和不同区域的内存访存效率和机制不相同，因此首先 根据 内存和`CPU`的关系，对内存进行分区，我们一般叫`node`，属于同一个`node`的内存表示他们位于同一个区域

- `zone`: 由于历史原因和硬件访存问题(`DMA`访问内存地址总线限制), 根据内存的物理地址范围把内存分为了不同的`zone`，比如`32bit`物理地址范围的内存分在了`zone: DMA32` 
  
  目前为止，再每个`zone`里面持有`free list head` 

- `order`: 每个`zone`并不只有一个`free list head`,实际上，内核采用的`buddy`内存分配算法(后面会介绍)，会把不同`order`（连续的`struct page` , `order=0` 代表一个`page`m `order=1`代表2个page， `order=2`代表4个page ）的空闲内存`page` 分别挂在他们各自的`free list`，因此，会有多个不同`order`的`free list` 

#### NUMA: pglist_data

之前已经介绍过`NUMA`的内存概念，绝大多数非服务器场景都不会涉及，但是我们这里还是假设`NUMA`开启的情况下讨论内存管理，因为关闭的场景只会比开启场景更加简单

`NUMA`场景下，内核会根据`NUMA node` 首先把内存分为不同的`node` 

```c
struct pglist_data *node_data[MAX_NUMNODES];
```

`pglist_data` 数组 `node_data`, 每个`node` 按照自己的下标 拥有一个`pglist_data`

每一个`pglist_data` 代表每个`node`所管理和维护的内存

#### ZONE

我们已经知道，除了根据`node`区分内存之外，还需要根据`ZONE` 对物理内存做出区分，常见的`ZONE`的类型有

- `ZONE_DMA(32)`： `DMA`内存区域

- `ZONE_HIGHMEM`: `arm64`位不存在，`arm32`位支持,表示高端内存

- `ZONE_NORMAL`: 普通内存区域

- `ZONE_MOVABLE`：和`zone_nomral` 类似， 只是显示的标识出这些内存是`MOVAABLE` 也就是可以迁移移动的，需要保证如果从此内存区分配的内存最好是可以移动的，不要分配一些特殊不可移动内存，内存下线会尝试迁移这部分物理内存，如果存在不可移动内存，可能会导致内存下线失败

- `ZONE_DEVICE`： Device memory (pmem, HMM, etc...) hotplug support,只有在热插拔开启有效

`64`位架构下 ，我们现在只需要考虑`ZONE_DMA\ZONE_NORMAL\ZONE_MOVALBE`即可，其他内存区域在特殊场景和需求才会使用。

可以通过`kernelcore/movable_core` 等参数指定`NOMRAL` `MOVABLE`在整个系统中的内存比例

### 设计实现

在第一小节我们主要对几个概念做出了澄清 ，本节对内核具体的设计实现进行拆解

#### pglist_data

我们已经介绍过`pglist_data` 负责代表一个`node`节点所管理的内存，其中主要字段包括：

- `node_zones`: 属于本`node`负责管理的所有 `Zone`（数组）

- `nr_zones`: 本`node`管理的`zone`的数量

- `node_zonelists`：其中包含两个数组分别是  
  
  - `ZONELIST_FALLBACK`： 该数组中存放的都是本`node`的`zone`的引用吗(数组顺序按照 `zone`从大到小依次递减)
  
  - `ZONELIST_NOFALLBACK`： 存放所有除了本`node`外的 其他`node` 节点的所有`zone`的引用 ，如果本节点无法申请出内存，会尝试从其他节点申请（数组顺序按照`node`的远近距离排序，越靠近的再数组前面）

- `node_start_pfn`: 属于本节点范围内存的起始位置 （由`memblock`信息统计得到）

- `node_present_pages`： 本节点管理的真实内存页面数量

- `node_spanned_pages`： 本节点管理覆盖范围内的内存页面数量

- `node_id`： 本节点ID

- `totalreserve_pages` ： 每个节点不允许用户态空间申请的保留内存，保留内存是根据各个`zone` 的保留内存统计求和

#### zone

下列字段主要是和内存大小范围相关的字段：

- `zone_start_pfn`： 当前`zone`的内存起始位置

- `spanned_pages` :当前`zone`管理内存覆盖的页面数量(start + spanned = end)

- `present_pages`: 在 当前`zone`范围中实际真正有效的内存页面数量

- `managed_pages`： 当前zone 所管理的内存页面数量，等于·`present_pages - reserved_pages`

`zone` 里面有一个最重要的字段 代表`zone` 所拥有的空闲`page` 列表 ，那就是  `free_area`

```c
  struct free_area {                                                         
          struct list_head        free_list[MIGRATE_TYPES];                  
          unsigned long           nr_free;                                   
  };                      
 struct free_area        free_area[NR_PAGE_ORDERS];
```

这个字段是如此重要 因此我们需要稍微多花一点时间解释 下图直观列出了这个结构的形式

![](../image/free_area.png)

什么是`order`？

`order`表示连续的内存页，连续的数量为`2^order`  `order = 0` 表示1个页， `order =2 `表示连续的`2`页。空闲页首先按照`order` 区分，是考虑到连续内存的申请，在后面`buddy`子系统会详细阐述

什么是`migrate_type`? 

是对内存迁移类型的一个划分，不同类型可能有不同的属性 

关于内存区域的范围大小字段都会在`free_area_init_node`  完成对应的初始化

#### pageblock_flags

内核把允许最大连续分配的物理内存叫做页块，每个页块的的地址都是以`pageblock_order` 对齐的；比如在`4k` 页表下, 大页内存开启时，`pageblock_order` 大小为2M

页块是`buddy`子系统分配内存的最大单位，从同一个页块中分出的内存具有相同的属性，比如`migrate_type` 

每一个页块都有对应的`flag` 标记 ，这里只讨论`sparse`开启的情况

`section->usage->pageblock_flags` 中存放着一个`64bit`的`flag`，记录当前`section`所拥有的页块的的`flags`

假设`页块`大小`2M`， 每个`section` 拥有`128M`的 `page`,其中`2M`对齐的`页块`数量就是 64个，每个块大小的`flag bits =NR_PAGEBLOCK_BITS ` 

```c
 #define PB_migratetype_bits 3                                              
  /* Bit indices that affect a whole block of pages */                       
  enum pageblock_bits {                                                      
          PB_migrate,                                                        
          PB_migrate_end = PB_migrate + PB_migratetype_bits - 1,             
                          /* 3 bits required for migrate types */            
          PB_migrate_skip,/* If set the block is skipped by compaction */    
                                                                                       /*                                                                 
           * Assume the bits will always align on a word. If this assumption 
           * changes then get/set pageblock needs updating.                  
           */                                                                
          NR_PAGEBLOCK_BITS                                                  
  };  
```

#### free_area_init

在有了上述关于`NUMA` `ZONE` `PAGE_FLAGS`的概念，我们总结一下，内核会通过`free_area_init`完成上述结构的初步的初始化，这些初始化工作包含

- 计算每个`node` 中的内存范围 并完成`node`的基本字段初始化

- 计算每个`zone`的内存范围，并完成`zone`的基本字段初始化(包括空闲链表)

- `__init_single_page` 遍历所有物理内存的`page` 完成相关基本字段的初始化工作

#### zoneinfo

关于`node` 和 `zone` 的信息都可以在`/proc/zoninfo` 看到

```shell
$ cat  /proc/zoneinfo
```

### 空闲链表初始化

上面我们介绍了`node zone` 甚至还介绍了一些`page` flags 的内容，在`bootmem_init`之后， 目前`zone`里面的`free_area` 依然都为空，那么空闲内存是什么时候真正被填充的呢？

#### mm_core_init

这是内存子系统的核心初始化，一旦此函数调用结束，意味着`内存子系统`处于可用状态

在这个函数过程中，从`memblock` 到 `page allocator` 完成关键资源交换的动作是`memblock_free_all`

```c
  void __init memblock_free_all(void)                                        
  {                                                                          
          unsigned long pages;                                                                                           
          reset_all_zones_managed_pages();                                                                                                     
          pages = free_low_memory_core_early();                              
          totalram_pages_add(pages);                                         
  }   

   static unsigned long __init free_low_memory_core_early(void)               
  {                                                                          
          unsigned long count = 0;                                           
          phys_addr_t start, end;                                            
          u64 i;                                                                                                                                                                                                 
          memmap_init_reserved_pages();                                      

          // 遍历所有无特殊标志的空闲内存  释放到链表                      
          for_each_free_mem_range(i, NUMA_NO_NODE, MEMBLOCK_NONE, &start,
                                   &end, NULL)                                      
                  count += __free_memory_core(start, end);                   

          return count;                                                      
  }
```

#### memblock_free_late

一旦`page allocator`的初始化之后，其他子系统如果希望释放之前从`memblock`申请的内存，需要通过接口`memblock_free_late` ，此接口逻辑和上一个小节类似，同样会把相关的内存页释放给`page allocator`

#### __free_pages_core

上面两个接口都会进入`__free_pages_core` 

```c
  void __meminit __free_pages_core(struct page *page, unsigned int order,    
                  enum meminit_context context)                              
  {                                                                          
          unsigned int nr_pages = 1 << order;                                
          struct page *p = page;                                             
          unsigned int loop;                                                 

           for (loop = 0; loop < nr_pages; loop++, p++) {             
               __ClearPageReserved(p);    
               //重置引用计数                        
               set_page_count(p, 0);                              
           }                                                                                                                      
          /*                                                                 
           * Bypass PCP and place fresh pages right to the tail, primarily   
           * relevant for memory onlining.                                   
           */                                                                
          __free_pages_ok(page, order, FPI_TO_TAIL);                         
  } 
```

 从`__free_pages_ok` 就涉及到`page allocator`的核心逻辑了 我们在下一小节讲 
