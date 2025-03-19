## 启动时间优化

### WorkQueue

#### 案例: trace  eval map

- commit: f6a694665f132（ tracing: Offload eval map updates to a work queue）
  
  分析: 

#### 案例: Wq  竞争

- commit: 6621a7004684（tracing: make tracer_init_tracefs initcall asynchronous）

分析： 

### 空间换时间

#### spares mem alloc

在稀疏内存模型下，可以通过开启 `CONFIG_SPARSEMEM_STATIC` 关闭`sparse sections`的动态启动内存分配，使用静态分配 ，核心在于下面代码

```c
 #ifdef CONFIG_SPARSEMEM_EXTREME
  struct mem_section **mem_section;
 #else
  struct mem_section mem_section[NR_SECTION_ROOTS][SECTIONS_PER_ROOT]
          ____cacheline_internodealigned_in_smp;
 #endif
  EXPORT_SYMBOL(mem_section);
```

但是，静态分配 `mem_section[]` 数组可能会消耗大量 `.bss`，因此请小心。

`4k`页表下,`PA_BITS=48`浪费内存空间可以计算为：  

数组长度为： `1 << (48- 27) = 0x20 0000`  如果 `mem_section` 大小为8byte ，则浪费内存空间大约为`16MB` 

测试：未开启`静态数组`的配置，BSS段大小为 `b9910`

```shell
# readelf -S vmlinux
[31] .bss              NOBITS           ffff800082b9a000  02ba9200
00000000000b9910  0000000000000000  WA       0     0     4096
```

开启后`200b9950` 

```shell
 [31] .bss              NOBITS           ffff800082b9a000  02ba9200
00000000200b9950  0000000000000000  WA       0     0     4096
```
