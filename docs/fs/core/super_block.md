## super block

```json
"node" {
    "label": "super_block",
    "categories": ["fs"],
    "info": "FileSystem super block",
    "depends": [
        "fs_context",
        "rw_sem"
    ]
}
```

### 介绍

超级块本质上是文件系统的元数据，它定义了文件系统的类型、大小、状态以及其他元数据结构的信息（元数据的元数据）。 超级块对文件系统非常重要，因此每个文件系统都存储有多个冗余副本。

#### 模块关联性

### 内核实现

#### struct super_block

我们可以看到这是一个极其庞大的结构体，因为它太过于重要

```c
  struct super_block {
          struct list_head        s_list;         /* Keep this first */
          dev_t                   s_dev;          /* search index; _not_ kdev_t */
          unsigned char           s_blocksize_bits;
          unsigned long           s_blocksize;
          loff_t                  s_maxbytes;     /* Max file size */
          struct file_system_type *s_type;
          const struct super_operations   *s_op;
          const struct dquot_operations   *dq_op;
          const struct quotactl_ops       *s_qcop;
          const struct export_operations *s_export_op;
          unsigned long           s_flags;
          unsigned long           s_iflags;       /* internal SB_I_* flags */
          unsigned long           s_magic;
          struct dentry           *s_root;
          struct rw_semaphore     s_umount;
          int                     s_count;
          atomic_t                s_active;
  #ifdef CONFIG_SECURITY
          void                    *s_security;
  #endif
          const struct xattr_handler * const *s_xattr;
  #ifdef CONFIG_FS_ENCRYPTION
          const struct fscrypt_operations *s_cop;
          struct fscrypt_keyring  *s_master_keys; /* master crypto keys in use */
  #endif
  #ifdef CONFIG_FS_VERITY
          const struct fsverity_operations *s_vop;
  #endif
  #if IS_ENABLED(CONFIG_UNICODE)
          struct unicode_map *s_encoding;
          __u16 s_encoding_flags;
  #endif
          struct hlist_bl_head    s_roots;        /* alternate root dentries for NFS */
          struct list_head        s_mounts;       /* list of mounts; _not_ for fs use */
          struct block_device     *s_bdev;        /* can go away once we use an accessor for @s_bdev_file */
          struct file             *s_bdev_file;
          struct backing_dev_info *s_bdi;
          struct mtd_info         *s_mtd;
          struct hlist_node       s_instances;
          unsigned int            s_quota_types;  /* Bitmask of supported quota types */
          struct quota_info       s_dquot;        /* Diskquota specific options */
          struct sb_writers       s_writers;

          /*
           * Keep s_fs_info, s_time_gran, s_fsnotify_mask, and
           * s_fsnotify_info together for cache efficiency. They are frequently
           * accessed and rarely modified.
           */
          void                    *s_fs_info;     /* Filesystem private info */

          /* Granularity of c/m/atime in ns (cannot be worse than a second) */
          u32                     s_time_gran;
          /* Time limits for c/m/atime in seconds */
          time64_t                   s_time_min;
          time64_t                   s_time_max;
  #ifdef CONFIG_FSNOTIFY
          u32                     s_fsnotify_mask;
          struct fsnotify_sb_info *s_fsnotify_info;
  #endif

          char                    s_id[32];       /* Informational name */
          uuid_t                  s_uuid;         /* UUID */
          u8                      s_uuid_len;     /* Default 16, possibly smaller for weird filesystems */

          /* if set, fs shows up under sysfs at /sys/fs/$FSTYP/s_sysfs_name */
          char                    s_sysfs_name[UUID_STRING_LEN + 1];

          unsigned int            s_max_links;

          /*
           * The next field is for VFS *only*. No filesystems have any business
           * even looking at it. You had been warned.
           */
          struct mutex s_vfs_rename_mutex;        /* Kludge */

          /*
           * Filesystem subtype.  If non-empty the filesystem type field
           * in /proc/mounts will be "type.subtype"
           */
          const char *s_subtype;  

          const struct dentry_operations *s_d_op; /* default d_op for dentries */

          struct shrinker *s_shrink;      /* per-sb shrinker handle */

          /* Number of inodes with nlink == 0 but still referenced */
          atomic_long_t s_remove_count;

          /* Read-only state of the superblock is being changed */
          int s_readonly_remount;

          /* per-sb errseq_t for reporting writeback errors via syncfs */
          errseq_t s_wb_err;

          /* AIO completions deferred from interrupt context */
          struct workqueue_struct *s_dio_done_wq;
          struct hlist_head s_pins;  

          struct user_namespace *s_user_ns;

          /*
           * The list_lru structure is essentially just a pointer to a table
           * of per-node lru lists, each of which has its own spinlock.
           * There is no need to put them into separate cachelines.
           */
          struct list_lru         s_dentry_lru;
          struct list_lru         s_inode_lru;
          struct rcu_head         rcu;
          struct work_struct      destroy_work;

          struct mutex            s_sync_lock;    /* sync serialisation lock */ 

          int s_stack_depth;

          /* s_inode_list_lock protects s_inodes */
          spinlock_t              s_inode_list_lock ____cacheline_aligned_in_smp;
          struct list_head        s_inodes;       /* all inodes */

          spinlock_t              s_inode_wblist_lock;
          struct list_head        s_inodes_wb;    /* writeback inodes */
  } __randomize_layout;
```
