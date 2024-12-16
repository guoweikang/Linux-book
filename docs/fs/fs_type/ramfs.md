## RAM FS

`ramfs` 故名思议，其实就是linux 以内存为存储介质的文件系统， 另外，还有很多其他文件系统是基于`ramfs`实现的,比如`procfs`等

### 内核实现

#### ramfs_fs_type

`filesystemtype` 声明

```c
static struct file_system_type ramfs_fs_type = {
          .name           = "ramfs",
          .init_fs_context = ramfs_init_fs_context,
          .parameters     = ramfs_fs_parameters,
          .kill_sb        = ramfs_kill_sb,
          .fs_flags       = FS_USERNS_MOUNT,
};
```

#### 注册时机
