## fc_log

```json
"node" {
    "label": "fc_log",
    "categories": ["fs"],
    "info": "fs context log",
    "depends": [
        "log",
        "refcount",
        "kalloc"
    ]
}
```

### 介绍

文件系统实现了一个自己的日志封装和API 

### 实现方法

#### struct  p_log

```c
  struct p_log {
          const char *prefix;
          struct fc_log *log;
  };     

 struct fc_log { 
          refcount_t      usage;  
          u8              head;           /* Insertion index in buffer[] */
          u8              tail;           /* Removal index in buffer[] */
          u8              need_free;      /* Mask of kfree'able items in buffer[] */
          struct module   *owner;         /* Owner module for strings that don't then need freeing */
          char            *buffer[8];
  };
```

- prefix ： 日志输出前缀 一般会被初始化为对应的文件系统名称

- fc_log :  fc context日志缓冲区

#### API : logfc

```c
  void logfc(struct fc_log *log, const char *prefix, char level, const char *fmt, ...)
```

核心日志输出接口

- `fc_log`: 日志输出缓冲区，如果为`null`,退化为`printk`

- prefix: 用于日志输出前缀

- level:  
  
  - `w` warning
  
  - `e`： error

- `fmt`： 日志内容

```c
#define __logfc(fc, l, fmt, ...) logfc((fc)->log.log, NULL, \
                                          l, fmt, ## __VA_ARGS__)

#define __plog(p, l, fmt, ...) logfc((p)->log, (p)->prefix, \
                                          l, fmt, ## __VA_ARGS__)
```

 分别对应为: 

- `__logfc`: 入参 为`fs_context`  实际上`fs_context -> p_log -> fc_log`

- `__plog`: 入参 为`p_log` 实际上`p_log -> fc_log`

本质上是一样的，一个额外关心 `prefix` 

 !!! note 

    Q： `__logfc`这里为什么 不提供 `prefix`? 比如 `(fc)->log->prefix`
    A: 查看提交记录，可能是为了考虑兼容早期的实现

#### API : info/error/warn

```c
#define infof(fc, fmt, ...) __logfc(fc, 'i', fmt, ## __VA_ARGS__)
#define info_plog(p, fmt, ...) __plog(p, 'i', fmt, ## __VA_ARGS__)
#define infofc(p, fmt, ...) __plog((&(fc)->log), 'i', fmt, ## __VA_ARGS__)
```

### API:fscontext_alloc_log

`fc_log` 资源申请

```c
 static int fscontext_alloc_log(struct fs_context *fc)
  {
          fc->log.log = kzalloc(sizeof(*fc->log.log), GFP_KERNEL);
          if (!fc->log.log)
                  return -ENOMEM; 
          refcount_set(&fc->log.log->usage, 1);
          fc->log.log->owner = fc->fs_type->owner;
          return 0;
  }
```
