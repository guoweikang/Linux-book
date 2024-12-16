## MMU

### 介绍

```json
node" {
    "label": "mmu",
    "categories": ["mem"],
    "info": "kernel mmu manage",
    "depends": [
        "kernel_map"，
        "fixmap",
        "memblock"
    ]
}
```

在内核映射章节，我们介绍了内核镜像的内存映射过程，而且我们已经知道了  此时内核的页表基址为`swapper_pg_dir`

在`mm/init-mm.c` 定义了 一个变量 `init_mm`

```c
  struct mm_struct init_mm = {
          .mm_mt          = MTREE_INIT_EXT(mm_mt, MM_MT_FLAGS, init_mm.mmap_lock),
          .pgd            = swapper_pg_dir,
          .mm_users       = ATOMIC_INIT(2),
          .mm_count       = ATOMIC_INIT(1),
          .write_protect_seq = SEQCNT_ZERO(init_mm.write_protect_seq),
          MMAP_LOCK_INITIALIZER(init_mm)
          .page_table_lock =  __SPIN_LOCK_UNLOCKED(init_mm.page_table_lock),
          .arg_lock       =  __SPIN_LOCK_UNLOCKED(init_mm.arg_lock),
          .mmlist         = LIST_HEAD_INIT(init_mm.mmlist),
  #ifdef CONFIG_PER_VMA_LOCK
          .mm_lock_seq    = 0,
  #endif
          .user_ns        = &init_user_ns,
          .cpu_bitmap     = CPU_BITS_NONE,
          INIT_MM_CONTEXT(init_mm)
  };    
```

`mm_struct` 此时我们先不用关注，这里只需要知道 `init_mm`作为初始任务内存结构的总入口，这里我们可以看到，`init_mm`引用了`swapper_pg_dir`

### 核心API

#### API : create_mapping_noalloc

此接口为虚拟内存和物理内存建立映射关系

```c
  void create_mapping_noalloc(phys_addr_t phys, unsigned long virt,
     phys_addr_t size, pgprot_t prot)        
```

!!! note

     前提依赖，要求虚拟内存需要的对应的页表项已经填充，否则会panic

#### API : create_pgd_mapping

此接口为虚拟内存和物理内存建立映射关系，如果需要 会根据要求申请新页表

```c

```
