## 物理内存管理

```json
"node" {
    "label": "mem_to_page",
    "categories": ["mem"],
    "info": "mem page pfn mapping",
    "depends": []
}
```

我们已经学习过了，内核启动阶段，通过`memblock` 以及`线性映射`，初步接管了系统的物理内存

memblock的管理过于简单他的存在主要是为了给后续真正的内存管理提供内存管理基础

本节我们将深入linux 物理内存管理的第二个世界 

### 概念介绍

#### PFN

物理页帧号，内核根据`MMU`配置的`页大小`，给每个页编了一个序号，这个页号就叫`页帧编号`

举例说明: ARM32位下，CPU 可以访问的物理内存范围 `0x00000000 - 0xffff ffff`，如果按照4K页大小，可以得知，
有效物理内存范围内，一共需要(0xf ffff)个页帧，编号从(0-1048575)

可以看到，`页帧编号`还是非常好理解的,直接和`实际物理地址` 以及 `页的大小` 关联

内核提供的关于页帧的转换公式有: 

```
// 根据当前物理地址 获取下一个页帧的起始地址
#define PFN_ALIGN(x)    (((unsigned long)(x) + (PAGE_SIZE - 1)) & PAGE_MASK)
//根据当前物理地址  获取下一个页帧号
#define PFN_UP(x)       (((x) + PAGE_SIZE-1) >> PAGE_SHIFT)
//根据当前物理地址  获取上一个页帧号
#define PFN_DOWN(x)     ((x) >> PAGE_SHIFT)
//给定页帧，获取他的页帧起始物理地址
#define PFN_PHYS(x)     ((phys_addr_t)(x) << PAGE_SHIFT)
//给定物理地址，获取他的页帧号
#define PHYS_PFN(x)     ((unsigned long)((x) >> PAGE_SHIFT))    
```

下图展示了上述过程：

![Screenshot](image/36.png)

#### 页帧

物理内存有了`PFN`编号，为了描述每个页，现在还需要一个抽象的结构体，我们把这个抽象的结构体叫`struct page`

对应每个PFN有一个结构体，用以记录该物理内存的: 状态(比如是否被使用、是否被锁、dirty信息等) 

#### 映射关系

 映射关系 帮助我们建立 从 `内存地址`  到 该内存所属`page`的关系 

首先我们已经可以在`内存地址`和  `PFN` 建立关系，在如何从`PFN`和`page`结构体建立联系呢？这就涉及到接下来的内容 , `struct page`内存布局

##### 平坦模型

能够快速通过`pfn` 找到对应的`struct page` 决定了内存管理的复杂度和性能，为了管理物理内存，
内核在不同时期引入了几种模型，到今天为止，只剩下两个模型在使用

第一种： 早期和嵌入式环境下的平坦内存模型(最简单的一个连续数组)

![Screenshot](image/37.png)

从 `PFN` 到 `struct page` 数组的转换就非常简单: 

```
#define __pfn_to_page(pfn)      (mem_map + ((pfn) - ARCH_PFN_OFFSET))
#define __page_to_pfn(page)     ((unsigned long)((page) - mem_map) +  ARCH_PFN_OFFSET)
```

`mem_map`数组下标 和 `PFN` **一一对应** 

为了符号上面的转换公式，`mem_map`必须满足以下要求: 

- `mem_map`数组需要覆盖架构所有内存
- `mem_map`数组必须要是连续的，否则无法**一一对应**

上述要求直接导致:

- 在64位架构下，`mem_map`数组如果要覆盖所有内存,自己占用的内存是`非常可怕的`
- 真实的设备，`RAM`根本不会占用所有的物理地址，数组中存在大量`空洞`
- NUMA以及内存热插拔的技术出现，平坦内存模型也无法更好适应 

因此，linux内核当前主要使用 第二种内存模型:**稀疏内存模型**

### 稀疏模型

在学习稀疏内存模型之前，先介绍一下 NUMA 和 UMP的内存访问模型

![Screenshot](image/38.png)

NUMA对不同numa 节点，提出了内存单独管理的诉求，在加上 内存热插拔的出现，平坦模型已经无法在胜任了

下图是**稀疏内存模型** 的`page`组织结构

![Screenshot](image/39.png)

让我们在描述下 section数组所使用内存的计算过程:

1. 一个`mem_section` 最少代表的连续内存？ `SECTION_SIZE_MEM` = `128Mb` (在我们平台下)
2. 覆盖所有物理内存需要多少个`mem_seciton` ?   `NR_SECTIONS` = `ARCH_PHYS/SECTION_SIZE_MEM`
3. `mem_section` 结构体大小 ? `size_of(struct mem_section)` 
4. 一个 ROOT(隐含`PAGE_SIZE`)可以存放多少个 `mem_section` : 
   `PER_ROOT_NR_SECTIONS` = `PAGE_SIZE/size_of(struct mem_section)`
5. 需要多少个ROOT 可以覆盖所有的物理内存? `ROOT_SIZE`= `NR_SECTIONS/PER_ROOT_NR_SECTIONS`

我们看到了section数组的计算公式，那么稀疏内存是如何节约内存的？这里的核心在于 **section数组的内存采用了动态按需分配**

我们还是举个例子描述这个过程，假设当前设备的RAM大小为`512MB`,且地址范围正好在`0-512MB` ，在64位架构下,物理地址范围`ARCH_PHYS`

1. 覆盖所有的物理内存需要 `ROOT_SIZE`个ROOT，因此 `mem_sections = malloc(sizeof(void *) * ROOT_SIZE)`
   实际不会很大,单位是一个指针
2. 经过确认，`0-512MB`都在`ROOT1`里面，因此 `mem_section[0] = = malloc(PAGE_SIZE)` （分配了4KB）
3. 经过确认, `0-512MB`可以通过`ROOT1`里面的前两个section覆盖,
   `mem_section[0][0].mem_map = malloc(sizeof(struct Page) * N)`
   `mem_section[0][1].mem_map = malloc(sizeof(struct Page) * N)`

通过上述过程，可以看到，`page 数组` 通过多级拆分，做到了按需动态分配,当然，这里存在内存浪费的情况，完全可以忍受

- `ROOT`一级数组，基本不会都使用(很像我们之前讲多级页表的第一级页表)
- `ROOT`第二级数组，也不一定都会使用，比如上面例子只使用了前两个 
- `page数组`也可能不会全都使用,上面的例子正好是`128M`的倍数，如果RAM大小`64M`，则`section page 数组` 只使用一半

到这里我基本对稀疏内存模型的核心设计做完了阐述,让我们回到 从`PFN`到 `struct page` 的转换, 
由于`page 数组`在稀疏内存中的不连续性,`pfn`必须要经过多次决策才能找到对应的`page`

1. `pfn` 对应的`ROOT`下标
2. `pfn` 对应的`mem section`下标
3. `pfn` 对应在`mem_map`下标
4. `page of pfn` = `mem_section[x][y].mem_map[z]`

```
/*
* Note: section's mem_map is encoded to reflect its start_pfn.
* section[i].section_mem_map == mem_map's address - start_pfn;
*/
#define __page_to_pfn(pg)                                       \
({      const struct page *__pg = (pg);                         \
        int __sec = page_to_section(__pg);                      \
        (unsigned long)(__pg - __section_mem_map_addr(__nr_to_section(__sec))); \
})

#define __pfn_to_page(pfn)                              \
({      unsigned long __pfn = (pfn);                    \
        struct mem_section *__sec = __pfn_to_section(__pfn);    \
        __section_mem_map_addr(__sec) + __pfn;          \
})
```

#### 初始化

稀疏内存结构模型初始化路径为;

```
    - start_kerenl 
     - setup_arch
      - bootmem_init 
       - sparse_init
        - memblocks_present() 利用memblock信息, 初始化 mem_section 数组，先把需要用到的section内存分配出来
        - sparse_init_nid 循环遍历所有numa节点，申请和初始化 section内部结构，比如 section_mem_map 的申请 
```

#### vmemmap

由于在稀疏模型下`PFN`和`page`的互相索引的性能问题 引入了`VMEMAP`的概念

![Screenshot](image/41.png)

`section`通过分段，按需动态申请内存的方式，解决了 如果要映射全部物理内存范围，`page数组`占用过大物理内存的问题
但是通过把`page数组` 重新映射到 `VMEMMAP`虚拟内存上，则解决了 `PFN` 到 `page`的索引效率问题

主要利用了 **虚拟内存不需要占用真的物理内存** 有足够的**虚拟内存资源** 可以使用

```
/* memmap is virtually contiguous.  */
#define __pfn_to_page(pfn)      (vmemmap + (pfn))
#define __page_to_pfn(page)     (unsigned long)((page) - vmemmap)
```

#### 初始化代码

稀疏内存结构模型初始化路径为; 

```
    - start_kerenl 
     - setup_arch
      - bootmem_init 
       - sparse_init
        - memblocks_present() 利用memblock信息, 初始化 mem_section 数组，先把需要用到的section内存分配出来
        - sparse_init_nid 循环遍历所有numa节点，申请和初始化 section内部结构，比如 section_mem_map 的申请 
         - __populate_section_memmap 建立 section_mem_map 到 vmemmap的内存映射
```
