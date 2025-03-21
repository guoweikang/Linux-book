## Struct



```json
node" {
    "label": "slub-struct",
    "categories": ["mem"],
    "info": "slub struct",
    "depends": [
            "slub-concepts"
    ]
}
```





We introduced `kmem_cache` `slab` `kmem_cache_cpu`  and `kmem_cache_node`  in last chapter.  

In this chapter, we'll learn their structs





### Slab

`slab` represents the continuous memory pages requested from `page allocator`



#### 复习和知识补充

为了介绍`slab` 我们需要在增加一些知识 ，我们已经学习了 `page allocator`, 那我们已经知道 每个 `page`大小的内存，都会有一个`struct page` 结构体表示 ，我们之前简单介绍过里面的`page flags` 字段 ，这一次在介绍更全面一点

我们统一假设我们的架构是`64bit`  如果是`32bit`架构 请自动缩减,

`page `里面大量使用`union`,目的是希望尽可能复用内存 减少 `page`大小，怎么通过`union`复用呢？ 那就是在`page`使用的不同阶段和场景，认为只会拥有`union`中的一个状态，也就是对同一个内存 在不同场景下可以有不同解释权



##### Page layout

下面是`page`的布局

- 8Byte : 仅有一个解释权 表示 page flags

- 40Byte: 有5种解释
  
  -  用来作为 `PageCache` 和  `anonymous pages`  被解释
  
  - 用来作为`netstack` 的`page _pool` 被解释
  
  - 作为`compound page` 被解释 
  
  - 作为`ZONE_DEVICE page` 被解释
  
  - 作为`rcu page` 被解释

- 4Byte： 两种解释 
  
  - page_type: 对于`filo`类型化的内存，表示内存类型，
  
  - map_count: 对于非类型化的内存，表示被页表映射的数量

- 4byte:  仅有一个解释权 `page` 使用引用计数

- 其他：无特殊使用情况



##### folio

`struct page` 结构体，在不同场景下，也可以转为相同内存大小布局的其他结构体，举例 

```c
struct Animal {
    int age;
    int gender;
}

struct Dog {
        long info; // low32 bit is gender, high32bit is age   
}


struct Animal an = {13, 1};
struct Dog *d = (struct Dog*) an;
```

这里的例子比较粗糙，但是能够说明一些问题，`struct page` 在被不同系统分配后，可以解释为另外的结构体，这里我们先了解一种情况： 

当携带有 `__GFP_COMP`标志从 `page allocator`申请内存时，`page_allocator` 会把`page` 转为 `filo`结构  



观察一下`folio`主要布局 

- First Page 
  
  - 8Byte : 表示 page flags, 和 `struct page`一致
  
  - 

 









































请注意，我们看到上面有个`page_byte` 字段，










