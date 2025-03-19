## Slub APi

```json
node" {
    "label": "slub-api",
    "categories": ["mem"],
    "info": "slub api",
    "depends": [
        "gfp",
    ]
}
```

### Alloc Kernel  Kmem_cache

对外 API 的声明都位于`include/linux/slab.h`文件中

本小节`API` 用于申请内核提供的`kmem_cache` 内存，如果用户希望自己定义`kmem_cache` 参考下个小节

接下来介绍的大部分接口 都依然会包含这两个参数：

- `gfp flags`，关于`gfp`的说明 我们已经再`page allocator` 讲的非常详细了，[官网参考](Documentation/core-api/memory-allocation.rst) ，这里仅对部分重要的flag 复习
  
  - `GFP_KERNEL`：最常用用于申请普通的内核内存，可以休眠
  
  - `GFP_NOWAIT`： 不允许休眠
  
  - `GFP_ATOMIC`： 不允许休眠，并且允许使用紧急内存
  
  - 下面可以和上面三个混合使用
  
  - `__GFP_ZERO`：自动清空内存
  
  - `__GFP_HIGH`： 高优先级任务，允许使用紧急内存
  
  - `__GFP_NOFAIL`： 不允许失败 会不断重试
  
  - `__GFP_NORETRY`： 如果没有可用内存，立即返回
  
  - `__GFP_NOWARN`： 如果失败 不报告内存失败告警

- `size`:希望申请的内存大小 

#### kmalloc/kmalloc_node/kzalloc

最常用的内存申请接口

```c
void *kmalloc(size_t size, gfp_t flags)
```

支持指定`node` 申请 

```c
void *kmalloc_node(size_t size, gfp_t flags, int node)
```

`kzalloc` 几乎等同于`kmalloc`, 区别在于会设置`GFP_ZERO` (用户如果自己对 

```c
// equal kmalloc(size, falgs|GFP_ZERO)
void *kzalloc((size_t size, gfp_t flags);
```

#### kmalloc_array/kmalloc_array_node/kcalloc

```c
void *kmalloc_array((size_t n, size_t size, gfp_t flags);

void *kmalloc_array_node((size_t n, size_t size, gfp_t flags, int node);

// equal kmalloc_array(n,size, falgs|GFP_ZERO)
void *kcalloc((size_t n, size_t size, gfp_t flags);
```

申请一段内存数组

`kcalloc` 几乎等同于`kmalloc_array`, 区别在于会设置`GFP_ZERO` (用户如果自己对` ``kmalloc_array`的 `gfp`增加该flags 行为和其相同)

##### krealloc_array

```c
void *kmalloc_array((void *p, size_t new_n, size_t new_size, gfp_t flags)
```

基于原有的内存`p`重新调整为新的内存数组大小

##### kvmalloc

`kvmalloc`默认会先尝试从`kmalloc`申请，如果`kmalloc`申请失败，并且申请的内存大于`PAGE_SIZE`的情况下，会真正进入申请`vmalloc`的流程

`kvmalloc`和 `kmalooc`最大区别在于不再尝试申请连续的物理内存，而是会尝试申请虚拟内存连续的内存，通过把虚存映射给不同的物理内存实现 虚拟内存连续访问

!!! note

    物理内存连续这个含义只存在于跨越`page`的内存访问上
