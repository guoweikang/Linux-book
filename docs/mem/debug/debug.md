# 内存调试文档

此部分内容整理linux 内存系统的相关调试

## 物理内存

### 内存初始化

#### dts内存扫描

由于memblock的物理内存信息主要来源于 设备树文件，为了验证设备树文件内存配置是否正确，可以通过:  

- 增加内核参数: `memblock=debug,debug` 选项，开启memblock 信息打印 

#### 内存坏块检测

适用于比如内存莫名发生变化 或者怀疑内存硬件出现问题，可以通过开启memtest: 

- 需要开启CONFIG_MEMTEST
- 需要指定内核参数:`memtest=n[10,100]` 该参数表示执行检测轮数 

原理是 memblock 内存管理建立好以后，会扫描所有内存，并且对内存进行读写测试，验证内存有效性；
如果发现内存坏块，会标记内存为reserved 不可用

```
[    0.000000] early_memtest: # of tests: 1
[    0.000000]   0x0000000040000000 - 0x0000000040210000 pattern 0000000000000000
[    0.000000]   0x00000000426fb000 - 0x0000000048000000 pattern 0000000000000000
[    0.000000]   0x0000000048116000 - 0x0000000048200000 pattern 0000000000000000
[    0.000000]   0x0000000048300000 - 0x000000005fef3950 pattern 0000000000000000
[    0.000000]   0x000000005fefcffc - 0x000000005fefd000 pattern 0000000000000000
```

#### 内存初始化日志开启

开启 CONFIG_DEBUG_MEMORY_INIT 内核参数设置:  mminit_loglevel=3 

```
[    0.000000] mminit::pageflags_layout_widths Section 0 Node 0 Zone 2 Lastcpupid 0 Kasantag 0 Gen 0 Tier 0 Flags 25
[    0.000000] mminit::pageflags_layout_shifts Section 21 Node 0 Zone 2 Lastcpupid 0 Kasantag 0
[    0.000000] mminit::pageflags_layout_pgshifts Section 0 Node 0 Zone 62 Lastcpupid 0 Kasantag 0
[    0.000000] mminit::pageflags_layout_nodezoneid Node/Zone ID: 64 -> 62
[    0.000000] mminit::pageflags_layout_usage location: 64 -> 62 layout 62 -> 25 unused 25 -> 0 page-flags
[    0.000000] mminit::memmap_init Initialising map node 0 zone 0 pfns 98304 -> 1048576
[    0.000000] mminit::memmap_init Initialising map node 0 zone 2 pfns 1048576 -> 2031616
[    0.000000] mminit::zonelist general 0:DMA = 0:DMA 
[    0.000000] mminit::zonelist general 0:Normal = 0:Normal 0:DMA 
[    0.000000] Initmem setup node 0 [mem 0x0000000018000000-0x00000001 efff ffff]
```

### Page Alloc

#### buddyinfo

可以查看`buddy`系统的 状态，下列命令会显示各个`zone`里面各个 `order`下空闲的链表数量

```shell
# cat /proc/buddyinfo
Node 0, zone      DMA      0      0      0      0      0      0      0      0      1      1      2 
Node 0, zone    DMA32   2032   2113   2009   1981   1736   1426   1121    743    476    213    252 
Node 0, zone   Normal 251006 164925  58722  21092   7935   3333   5112   9579   4989   3387   4391 
```

按照`1 2 4 8 ...` 的顺序列出不同`order` 的剩余节点个数 ，总的`free`计算公式为:

`1*n1 + 2 *n2 + .... 1024*n10`

#### 查看zone的内存

查看各个`ZONE` 的 全局信息 : `cat /proc/zoneinfo`

```
Node 0, zone   Normal  //Node和Zone 的信息
pages free     163627  // 空闲pages 数量
      min      10040   // 最低水位线
      low      12550   // 低水位线
      high     15060   // 高水位线
      spanned  983040  // zone覆盖区域
      present  360448  // Zone有效内存数量
      managed  343886  // ZONE里面buddy管理的内存(剩余的被memblock管理)
      cma      0       // ZONE里面作为CMA的内存数量
      protection: (0, 0, 0, 0)
      start_pfn  // zone起始 PFN
```

#### migrate type info

查看更加详细的`migrate_type` 的空闲链表信息

```shell
# cat /proc/pagetypeinfo 
Page block order: 10
Pages per block:  1024

Free pages count per migrate type at order       0      1      2      3      4      5      6      7      8      9     10 
Node    0, zone      DMA, type    Unmovable      0      0      0      0      0      0      0      0      1      1      0 
Node    0, zone      DMA, type      Movable      4      2      2      2      3      3      4      4      4      3    610 
Node    0, zone      DMA, type  Reclaimable      0      0      0      0      0      0      0      0      0      0      0 
Node    0, zone      DMA, type   HighAtomic      0      0      0      0      0      0      0      0      0      0      0 
Node    0, zone   Normal, type    Unmovable      1      1      0      0      0      0      0      0      1      1      0 
Node    0, zone   Normal, type      Movable      0      0      0      0      0      0      0      0      0      0    148 
Node    0, zone   Normal, type  Reclaimable      0      0      1      1      0      1      0      0      1      1      0 
Node    0, zone   Normal, type   HighAtomic      0      0      0      0      0      0      0      0      0      0      0 
Node    0, zone  Movable, type    Unmovable      0      0      0      0      0      0      0      0      0      0      0 
Node    0, zone  Movable, type      Movable      1      1      1      0      1      0      1      0      0      1     82 
Node    0, zone  Movable, type  Reclaimable      0      0      0      0      0      0      0      0      0      0      0 
Node    0, zone  Movable, type   HighAtomic      0      0      0      0      0      0      0      0      0      0      0 

Number of blocks type     Unmovable      Movable  Reclaimable   HighAtomic 
Node 0, zone      DMA            1          767            0            0 
Node 0, zone   Normal            4          148            1            0 
Node 0, zone  Movable            0          103            0            0 
```

#### PCP

##### PCP 使用状态

查看各个`ZONE` 的`PCP`使用状态 : `cat /proc/zoneinfo`   `pagesets` 表示`pcp`当前内存状态

```
Node 0, zone  Movable
  pages free     189663
        boost    0
        min      128
        low      317
        high     506
        promo    695
        spanned  209920
        present  209920
        managed  189726
        cma      0
        protection: (0, 0, 0, 0)
      nr_free_pages 189663
      nr_zone_inactive_anon 18
      nr_zone_active_anon 0
      nr_zone_inactive_file 0
      nr_zone_active_file 0
      nr_zone_unevictable 0
      nr_zone_write_pending 0
      nr_mlock     0
      nr_bounce    0
      nr_free_cma  0
      numa_hit     0
      numa_miss    0
      numa_foreign 0
      numa_interleave 0
      numa_local   0
      numa_other   0
  pagesets
    cpu: 0
              count: 34
              high:  317
              batch: 63
```

##### sysctl: percpu_pagelist_high_fraction

用户可以配置`percpu_pagelist_high_fraction`,修改系统允许`PCP`保留的最小空闲页面数量

修改`PCP`最低水位线

```c
echo "10" > /proc/sys/vm/percpu_pagelist_high_fraction 
```

通过手动修改 允许当内存紧张时 ，人为干预最低水位线，防止出现频繁的回收

#### 水位线

##### 查看wmark

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

##### sysctl： min_free_kbytes

用户可以手动调整系统的最小内存，内核默认推荐值为，该值直接影响`ZONE_DMA/NORMAL`的最低水位线

```shell
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
```

我当前系统内存大约为4G， 最小系统保留内存和最低水位线为

```shell
~ # cat /proc/sys/vm/min_free_kbytes
7458 
~ # cat /proc/zone_info
Node 0, zone   Normal
  pages free     237609
        boost    0
        min      517 // 517 * 4 = 2068 

Node 0, zone      DMA
  pages free     628841
        boost    0
        min      1346 // 1346 * 4 + 2068； 一共为 7458 KB
```

修改最小保留内存

```shell
~ # echo 10240 > /proc/sys/vm/min_free_kbytes
~ # cat /proc/zone_info
Node 0, zone   Normal
  pages free     237609
        boost    0
        min      710 // 710* 4 = 2840

Node 0, zone      DMA
  pages free     628841
        boost    0
        min      1849 // 1849 * 4 + 2840； 一共为 10240  KB
```

##### sysctl： watermark_scale_factor

调整水位线递增步长  `zone_managed_pages*scale/10000`

```shell
~ # cat /proc/sys/vm/watermark_scale_factor
10

Node 0, zone   Normal
  pages free     237609
        boost    0
        min      710
        low      951 // step = 951 - 710 = 241 = 241951 / 1000
        high     1192
        promo    1433
        spanned  262144
        present  262144
        managed  241951
```

调整后

```shell
~ # cat /proc/sys/vm/watermark_scale_factor
20

Node 0, zone   Normal
  pages free     237609
        boost    0
        min      710
        low      1193 // step = 1193 -710 = 483 =  241951 / 500
        high     1676
        promo    2159
        spanned  262144
        present  262144
        managed  241951
```

##### sysctl: lowmem_reserve_ratio

用户可以配置`lowmem_reserve_ratio`,调整为内核各个`zone`预留的内存比例( 不允许用户态的内存)，这样可以防止 `ZONE_NORMAL` 或 `ZONE_DMA` 这些低阶 `Zone` 中，某些关键组件（如 DMA 设备、内核结构）只能从这些区域分配内存。如果高阶 `Zone`（如 `ZONE_MOVABLE` 或 `ZONE_HIGHMEM`）的进程大量分配内存（又不释放），而没有任何限制，那么可能会导致：

- 低阶 Zone 被耗尽（即使高阶 `Zone` 还有大量空闲内存）
- 触发 **OOM（Out of Memory）**，导致系统崩溃或进程被杀死

`sysctl_lowmem_reserve_ratio[j]` 是一个可配置参数，默认值一般是 `{256, 256, 32, 0}`，表示：

- `ZONE_DMA` 需要超过目标`zone`的 `1/256` 

- `ZONE_DMA32` 需要超过目标`zone(normal和MOVABLE)`的 `1/256` 

- `ZONE_NORMAL` 需要超过目标`zone(movable)`的 `1/32` 

- `ZONE_MOVABLE` 没有 `lowmem_reserve`
  
  查看当前配置

```shell
~ # cat /proc/sys/vm/lowmem_reserve_ratio 
256    256    32    0
```

可以通过 `zone_info`查看当前`zone`的`lowmem_reserve`

```shell
  pages free     628948
        boost    0
        min      1521
        low      2148
        high     2775
        promo    3402
        spanned  786432
        present  786432
        managed  630079
        cma      0
        protection: (0, 0, 204, 945) // lowmem_reserve
```

可以调整 `lowmem_reserve_ratio` 设置是否允许当前`zone`给其他`zone`分配内存

我们增加`ZONE_DMA`的保护，要求必须保证有其他`zone`的`32分支1`参允许给其他内存分配，调大`8`倍

```shell
# echo "32 32 32 0" > /proc/sys/vm/lowmem_reserve_ratio 
  pages free     628948
        boost    0
        min      1521
        low      2148
        high     2775
        promo    3402
        spanned  786432
        present  786432
        managed  630079
        cma      0
        protection: (0, 0, 1632, 7560)
```

## 应用态内存

### valgrind

用户态 **动态** 内存泄漏诊断工具，主要用于监控堆内存，核心实现是对malloc/free wrap，这样程序堆上的内存都在他的监控之下，从而可以判断程序对这些内存的合法使用，可以用来检查

- 堆内存的非法访问(访问没有申请或者已经释放的内存 uaf)
- 堆内存的重复释放(double free)
- 堆内存泄漏(mem leak)

```
valgrind [options] process
```

### 地址消毒

llvm Sanitizers**动态** 内存泄漏诊断工具，运行时检测

- addressSanitizer: 检测到内存越界、double free、uaf 等问题
- leakSanitizer: 查找是否存在内存泄漏
- MemorySanitizer：内存消毒，查找是否使用未初始化的内存
- UndefinedBehaviorSanitizer： 查找是否存在空指针访问、整型越界
- ThreadSanitizer： 线程并发相关

基本原理时在编译阶段打桩实现

```
$ clang-12 -g -O0 -fsanitize=address,leak,undefined -Wall -Wextra -std=gnu99
$ clang-12  -fsanitize=address,leak,undefined 
```