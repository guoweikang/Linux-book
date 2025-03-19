## Page Allocator APi

```json
node" {
    "label": "gfp",
    "categories": ["mem"],
    "info": "gfp description",
    "depends": [
        "buddy",
        "zone",
        "migrate_type",
    ]
}
```

### API

对外 API 的声明都位于`include/linux/gfp.h`文件中 

#### __alloc_pages_noprof/__alloc_pages/alloc_pages

我们之前章节中已经讲过了 此接口位`page_allocator`的最底层核心接口 

入参除了必须的`gfp_flags/order` 之外，这些接口区别在于 是否 还需要提供`node`

#### alloc_pages_bulk_noprof/alloc_pages_bulk_list/alloc_pages_bulk_arrary

分配多个`order-0`物理内存页  

#### get_free_pages_noprof/__get_free_page(s)

区别在于此接口会直接得到`page` 代表的虚拟内存地址，可以直接用来使用

#### __free_pages/free_pages

释放`page（addr）`

### GFP标记

我们已经系统学习解释过`GFP` 各个标记的作用 实际在进行内存申请时，系统提供了一些常用的组合给我们使用

- GFP_KERNEL：内核常用的参数， 允许内存同步回收，其余都为默认

- GFP_ATOMIC：非阻塞标记，不允许内存同步回收， 并且允许访问紧急内存

- GFP_NOWAIT：非阻塞标记，不允许内存同步回收， 但是不允许访问紧急内存

- ...

更多解释参考 [内核文档](https://www.kernel.org/doc/html/latest/core-api/memory-allocation.html)
