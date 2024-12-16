## ROOT FS

```json
"node" {
    "label": "rootfs",
    "categories": ["fs"],
    "info": "kernel root filesystem type",
    "depends": [
        "obsolate param",
        "boot config",
        "kernel start",
        "memblock",
        "initcall",
        "schedule async",
        "tmpfs", 
        "usermodehelper",
        "ramfs"
    ]
}
```

Rootfs 应该是我们要第一个了解的`filesystem` ，从名字上看它属于一个特殊的文件系统，特殊在于他和不同的`blk` 或者`ram` 这些文件系统，是通过介质或者实现的不同区分，然而`rootfs`则完全是出于他在系统中的特殊性单独作为一个类型  

### 根目录挂载

让我们先在`qemu` 下面, 试着不指定任何根文件系统，看一下系统的报错

```shell
 qemu-system-aarch64 -M virt -cpu cortex-a57 -smp 1 -m 4G   -kernel build_qemu/arch/arm64/boot/Image  -nographic   -append " earlycon rdinit=/bin/sh ipv6.autoconf=0"
```

```vim
[    1.129382] /dev/root: Can't open blockdev
[    1.130513] VFS: Cannot open root device "" or unknown-block(0,0): error -6
[    1.131411] Please append a correct "root=" boot option; here are the available partitions:
[    1.132574] 1f00          131072 mtdblock0 
[    1.132697]  (driver?)
[    1.133445] List of all bdev filesystems:
[    1.133751]  ext3
[    1.133781]  ext2
[    1.133976]  ext4
[    1.134145]  squashfs
[    1.134334]  vfat
[    1.134543] 
[    1.135118] Kernel panic - not syncing: VFS: Unable to mount root fs on unknown-block(0,0)
[    1.136429] CPU: 0 UID: 0 PID: 1 Comm: swapper/0 Not tainted 6.12.0-next-20241125-dirty #1
[    1.137016] Hardware name: linux,dummy-virt (DT)
[    1.137730] Call trace:
[    1.138158]  show_stack+0x18/0x24 (C)
[    1.139260]  dump_stack_lvl+0x38/0x90
[    1.139647]  dump_stack+0x18/0x24
[    1.139969]  panic+0x388/0x3e8
[    1.140141]  mount_root_generic+0x210/0x340
[    1.140479]  mount_root+0x164/0x2d8
[    1.140799]  prepare_namespace+0x6c/0x2a8
[    1.141086]  kernel_init_freeable+0x250/0x290
[    1.141327]  kernel_init+0x20/0x1d8
[    1.141580]  ret_from_fork+0x10/0x20
[    1.142306] Kernel Offset: 0x52530ce00000 from 0xffff800080000000
[    1.142769] PHYS_OFFSET: 0xfff097a140000000
[    1.143092] CPU features: 0x088,0002013c,00800000,0200421b
[    1.143636] Memory Limit: none
[    1.144452] ---[ end Kernel panic - not syncing: VFS: Unable to mount root fs on unknown-block(0,0) ]---
```

可以看到这里清楚的报错, 提示我们 `vfs` 没有可以使用的根文件系统

内核做挂载根目录，然后才可以执行用户态的程序，内核一般会有两种挂载方式：

- 使用一个 `initramfs` 作为根目录挂载，执行`initramfs`目录下的 `/init` 执行用户脚本

- 使用`blk`设备挂载根目录

我们将针对不同情况，讲解内核的根目录挂载实现过程

#### fs type

```c
  static int rootfs_init_fs_context(struct fs_context *fc)
  {       
          if (IS_ENABLED(CONFIG_TMPFS) && is_tmpfs)
                  return shmem_init_fs_context(fc);

          return ramfs_init_fs_context(fc);
  }       

  struct file_system_type rootfs_fs_type = {
          .name           = "rootfs",
          .init_fs_context = rootfs_init_fs_context,
          .kill_sb        = kill_litter_super,
  };
```

从`rootfs_init_fs_context`实现上看，可以看到是基于`tmpfs` `ramfs`实现的

#### fs mount init

`fs`根目录挂载的初始化

```c
start_kernel()
 -> vfs_caches_init()
  -> mnt_init()
   // 确认rootfs类型
   -> init_rootfs()
   -> init_mount_tree() 
     -> vfs_kern_mount(&rootfs_fs_type, 0, "rootfs", NULL);
      -> fc = fs_context_for_mount()
      -> vfs_parse_fs_string(fc, "source","rootfs")
      -> parse_monolithic_mount_data(fc,null)
      -> mnt = fc_mount();
```

#### tmpfs or ramfs

```c
  void __init init_rootfs(void)
  {       
          if (IS_ENABLED(CONFIG_TMPFS)) {
                  if (!saved_root_name[0] && !root_fs_names)
                          is_tmpfs = true;
                  else if (root_fs_names && !!strstr(root_fs_names, "tmpfs"))
                          is_tmpfs = true;
          }
  }
```

哪些情况`rootfs`  使用 `tmpfs`

- `CONFIG_TMPFS` 必须支持

- boot config: 没有通过 `root=` 和 `rootfstype` 指定根文件设备和跟文件系统类型

- boot config: 通过 `rootfstype=` 指定 Root filesystem type 为`tmpfs` 

在上述情况下，rootfs 基于`tmpfs`实现 ，其他情况基于`ramfs`实现
