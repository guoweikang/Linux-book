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

### buddy子系统

#### 查看free order block 
从系统查看`buddy` order 的`free`信息`cat /proc/buddyinfo`
```
Node 0, zone      DMA      2      2      4      2      4      3      7      5      4      3    277 
Node 0, zone   Normal    329    190     91      1     30      7      4      2      2      1    158 
```

#### PCP
查看各个`ZONE` 的`PCP`使用状态 : `cat /proc/zoneinfo`  
```
Node 0, zone   Normal  //Node和Zone 的信息

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