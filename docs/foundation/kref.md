## Kref

```json
"node" {
    "label": "kref",
    "categories": ["foundation"],
    "info": "kernel refcount",
    "depends": ["refcount"]
}
```

`kref` 是 linux `refcont`的引用计数的封装结构，实际上非常简单

### 实现

#### struct kref

```
struct kref {
     refcount_t refcount;
};
```

#### 初始化

如果是静态初始化，可以使用 初始化宏

```c
#define KREF_INIT(n)    { .refcount = REFCOUNT_INIT(n), }
动态初始化，可以使用  `kref_init`
```

```c
static inline void kref_init(struct kref *kref)
{
      refcount_set(&kref->refcount, 1);
}             
```

#### kref_read

```c
  static inline unsigned int kref_read(const struct kref *kref)
```

#### kref_get

等同于 `refcount_inc`

```c
 static inline void kref_get(struct kref *kref)
  {
          refcount_inc(&kref->refcount);
  }
```

#### kref_put

此接口，额外支持在 `refcnt` 减为0时，主动调用一个`release callback`

```c
  static inline int kref_put(struct kref *kref, void (*release)(struct kref *kref))
  {
          if (refcount_dec_and_test(&kref->refcount)) {
                  release(kref);
                  return 1;
          }
          return 0;
  }
```

#### kref_put_mutex(lock)

等同于`refcount_dec_and_mutex_lock` 额外支持调用`release callback`

```c
  static inline int kref_put_mutex(struct kref *kref,
                                   void (*release)(struct kref *kref),
                                   struct mutex *lock)
  {
          if (refcount_dec_and_mutex_lock(&kref->refcount, lock)) {
                  release(kref);
                  return 1;
          }
          return 0
  }

  static inline int kref_put_lock(struct kref *kref,
                                   void (*release)(struct kref *kref),
                                   struct spinlock_t *lock);
```

!!! Note:

    一般在`release callback`中实现需要上锁的部分，并解锁

#### use sample
