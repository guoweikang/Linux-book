## Tmpfs

```json
"node" {
    "label": "tmpfs",
    "categories": ["fs"],
    "info": "a shared mem file system",
    "depends": [
        "fs_type",
        "fs_context"
    ]
}
```

### shmem_fs_type

`mm/shmem.c`

```c
  static struct file_system_type shmem_fs_type = {
          .owner          = THIS_MODULE,
          .name           = "tmpfs",
          // fs context init call back
          .init_fs_context = shmem_init_fs_context,
  #ifdef CONFIG_TMPFS
          .parameters     = shmem_fs_parameters,
  #endif
          .kill_sb        = kill_litter_super,
          .fs_flags       = FS_USERNS_MOUNT | FS_ALLOW_IDMAP,
  };
```

#### fc_context

`fc_context` 在通过 `shmem_init_fs_context`初始化后结果为 

```c
  int shmem_init_fs_context(struct fs_context *fc)
  {       
          struct shmem_options *ctx;

          ctx = kzalloc(sizeof(struct shmem_options), GFP_KERNEL);
          if (!ctx)
                  return -ENOMEM;

          ctx->mode = 0777 | S_ISVTX;
          ctx->uid = current_fsuid();
          ctx->gid = current_fsgid();

          fc->fs_private = ctx;
          fc->ops = &shmem_fs_context_ops;
          return 0;
  }       
```

`tmpfs`初始化后的`fc_context` 为  主要为： 

- fc->fs_private = `shmem_options`;

- fc->ops = `shmem_fs_context_ops`

可以看到这种设计模式和 `驱动设计模式`类似，属于相同结构的`fc_context `不同`fs type`的`context`， 拥有各自的 `fs_private` 私有数据 ，以及各自实现的`ops`操作函数
