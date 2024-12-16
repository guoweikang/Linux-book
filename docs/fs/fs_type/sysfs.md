## sysfs

### kobject

让我们回到本节主题`sysfs`,是内核提供的一个内存文件系统, 每个文件节点都在内核以一个内存中的结构体存在;
这个结构体就是 `kobject` 

sysfs的节点都以kobject的形式存在，让我们继续深入探讨实现机制之前，先简单看一下kobject的定义

```
    struct kobject {
        const char           *name; #文件名
        struct list_head    entry;
        struct kobject        *parent; #上级目录
        struct kset        *kset; #暂时先不关注
        struct kobj_type    *ktype; #重点关注一下
        struct kernfs_node    *sd; /* sysfs directory entry */
        struct kref        kref;  # kobject 引用计数
    #ifdef CONFIG_DEBUG_KOBJECT_RELEASE
        struct delayed_work    release;
    #endif
        unsigned int state_initialized:1;   # 初始化状态标记位
        unsigned int state_in_sysfs:1;      # 状态标记位
        unsigned int state_add_uevent_sent:1; # 状态标记位
        unsigned int state_remove_uevent_sent:1; # 状态标记位
        unsigned int uevent_suppress:1; # 状态标记位
    };
```

在一切开始之前，我们需要先关注一下 `kobj_type`，还记得我们在引用计数讲的，当引用计数减为0的时候，才能够释放资源？
kobject 的引用计数是kref，他的释放函数呢？
这里有一个背景知识先需要了解一下，因为一般情况下，几乎不会单独使用的kobject，毕竟他是没有什么实际含义的，
他是一个高层的抽象，我们真正使用 往往需要配合内核子系统使用，比如 fs 内存等
所以 kobject 一般都是伴随着其他子系统一起使用，因此他的释放 是通过初始化方式实现的 

```
    void kobject_init(struct kobject *kobj, struct kobj_type *ktype)
```

kobject_init 会明确要求需要传入一个kobj_type对象，这个结构如下

```
struct kobj_type {
    void (*release)(struct kobject *kobj);
    const struct sysfs_ops *sysfs_ops;
    struct attribute **default_attrs;    /* use default_groups instead */
    const struct attribute_group **default_groups;
    const struct kobj_ns_type_operations *(*child_ns_type)(struct kobject *kobj);
    const void *(*namespace)(struct kobject *kobj);
    void (*get_ownership)(struct kobject *kobj, kuid_t *uid, kgid_t *gid);
};
```

我们这里先只关注 release，该函数就是当 引用计数减为0的 资源释放回调

### 目录

```
    void kobject_init(struct kobject *kobj, struct kobj_type *ktype)；
    struct kobject *kobject_create(void)；
    int kobject_add(struct kobject *kobj, struct kobject *parent,const char *fmt, ...);
    struct kobject *kobject_create_and_add(const char *name, struct kobject *parent);
    void kobject_put(struct kobject *kobj)；
```

简单说明一下：

- kobject_init：初始化kobject的基本字段和状态，设置 state_initialized标志位， 初始化ktype以及kref引用计数
- kobject_create：kobject_init的封装版本，会通过kzalloc动态申请内存，并且使用默认的 kobj_type 初始化kobject
- kobject_add: 把kobject 加入到sysfs
- kobject_create_and_add： 上面两个函数的封装
- kobject_put: kobject 减少引用计数，如果引用计数减为0，会清理kobject 

注意区分 `init 、create、add `的区别，只有通过`kobject_add `才可以加入到`sysfs`，否则只是对kobject的初始化，
完成下面这个实验以后，我们会简单在剖析一下 内部实现

下面代码可以简单的创建一个 /sys/test目录

```
    #include <linux/init.h>   /* for __init and __exit */
    #include <linux/module.h> /* for module_init and module_exit */
    #include <linux/printk.h> /* for printk call */
    #include <linux/kobject.h> /* for printk call */
    #include <linux/sysfs.h> /* for printk call */

    MODULE_AUTHOR("Syntastic");
    MODULE_LICENSE("GPL");
    MODULE_DESCRIPTION("Test module");

    struct kobject *test_kobj;

    static int __init my_init(void)
    {
        test_kobj = kobject_create_and_add("test", NULL);
        if (!test_kobj)
            printk(KERN_ERR "create koject failed!\n");  

            printk(KERN_DEBUG "It works!\n");    /* missing semicolon */
            return 0;
    }

    static void __exit my_exit(void)
    {
        if (test_kobj) {
            kobject_put(test_kobj);
        }
        printk(KERN_DEBUG "Goodbye!\n");
    }

    module_init(my_init);
    module_exit(my_exit);
```

通过上面代码 我们可以看到sys在根目录下生成了 test 目录 下面是创建目录的核心代码逻辑

```
    - kobject_create_and_add
     - kobject_create
      - kzalloc(动态分配kobject)
      - kobject_init(kobj, &dynamic_kobj_ktype) //利用dynamic_kobj_ktype 作为ktype初始化，release就是kfree释放内存
        - kobject_init_internal： //初始化引用计数 初始化状态标志位 初始化 entry
        - kobj->ktype = ktype; // 初始化ktype 
     - kobject_add
      - kobject_add_varg
       - kobj->parent = parent;//设置父目录
       - kobject_add_internal      
        - 判断kobj是否有parent，如果没有使用kobj ->kset 作为parent 
        - kobj 加入kset 
        - create_dir(创建目录 和 目录下的文件)
        - state_in_sysfs =1 // 初始化状态标志位
```

下面是目录删除的核心逻辑

```
     - kobject-put
       - kref_put
        - kobject_release
         - kobject_cleanup
          - state_in_sysfs 
            - __kobject_del
             - sysfs_remove_groups
             - sysfs_remove_dir
             - sysfs_put
             - kobj->state_in_sysfs = 0
             - kobj_kset_leave(kobj); // kobject 离开kset
             - kobj->parent = NULL;
```

### 文件

如何在目录下生成文件呢？ sysfs 定义下面结构： 

```
    struct attribute {
        const char        *name; //指定文件名称
        umode_t            mode;  //文件的访问权限
    };

    struct attribute_group {
        const char        *name; //子目录名称
        umode_t            (*is_visible)(struct kobject *,
                            struct attribute *, int);  // 自定义函数，根据特定条件设置整个组的可见性
        umode_t            (*is_bin_visible)(struct kobject *,
                            struct bin_attribute *, int); 
        struct attribute    **attrs; // 子目录下的文件
        struct bin_attribute    **bin_attrs;
    };

    struct sysfs_ops {
        ssize_t    (*show)(struct kobject *, struct attribute *, char *);
        ssize_t    (*store)(struct kobject *, struct attribute *, const char *, size_t);
    };

    int sysfs_create_file(struct kobject *kobj, struct attribute *attr); //创建文件
    int sysfs_remove_file(struct kobject *kobj, struct attribute *attr); //移除文件
    int sysfs_create_group(struct kobject *kobj, const struct attribute_group *grp)； // 创建group
```

这两个属性分别以 单个文件/组文件的形式定义了 sysfs下的文件，以及文件读写操作函数的定义

在让我们回顾一下 ktype

```
    struct kobj_type {
        void (*release)(struct kobject *kobj);  // 定义kobject 释放函数
        const struct sysfs_ops *sysfs_ops;  // 指向 write read 操作函数
        struct attribute **default_attrs;    // 在kobject目录创建  默认包含的文件
        const struct attribute_group **default_groups; // 在kobject目录创建  默认包含的组文件
        const struct kobj_ns_type_operations *(*child_ns_type)(struct kobject *kobj);
        const void *(*namespace)(struct kobject *kobj);
        void (*get_ownership)(struct kobject *kobj, kuid_t *uid, kgid_t *gid);
    };
```

那么 sysfs_ops 是在哪里初始化的？ 回到`kobject_create_and_add` 的逻辑里面， 
kobject 默认使用 `dynamic_kobj_ktype `初始化ktype 默认的ktype 的ops定义如下

```
    const struct sysfs_ops kobj_sysfs_ops = {
        .show   = kobj_attr_show,  // ktype 默认的show 和 store 使用统一的接口 
        .store  = kobj_attr_store,
    }

    /* default kobject attribute operations */
    static ssize_t kobj_attr_show(struct kobject *kobj, struct attribute *attr,
                    char *buf)
    {
        struct kobj_attribute *kattr;
        ssize_t ret = -EIO;

        kattr = container_of(attr, struct kobj_attribute, attr); // 通过不同的attr 在得到各自的 show 和 store 实现针对不同文件的ops的定义
        if (kattr->show)
            ret = kattr->show(kobj, kattr, buf);
        return ret;
    }

    static ssize_t kobj_attr_store(struct kobject *kobj, struct attribute *attr,
                    const char *buf, size_t count)
    {
        struct kobj_attribute *kattr;
        ssize_t ret = -EIO;

        kattr = container_of(attr, struct kobj_attribute, attr);
        if (kattr->store)
            ret = kattr->store(kobj, kattr, buf, count);
        return ret;
    }
```

这里面有一个核心关注点：kobj_attribute 对 attribute 进行了封装，从而实现不同attr 拥有不同的ops

下面代码可以简单的在 /sys/test目录下创建一个hello_world，可以向hello_world 写入字符串，以及回显他刚才写入的字符串

```
    #include <linux/init.h>   /* for __init and __exit */
    #include <linux/module.h> /* for module_init and module_exit */
    #include <linux/printk.h> /* for printk call */
    #include <linux/kobject.h> /* for printk call */
    #include <linux/sysfs.h> /* for printk call */

    MODULE_AUTHOR("Syntastic");
    MODULE_LICENSE("GPL");
    MODULE_DESCRIPTION("Test module");

    static struct kobject *test_kobj;
    static char hello_str[1024];


    ssize_t  hello_show (struct kobject *kobj, struct kobj_attribute *attr,char *buf) 
    {
        return sprintf(buf, "%s\n", hello_str);
    }

    ssize_t  hello_store(struct kobject *kobj, struct kobj_attribute *attr, const char *buf, size_t count)
    {
        return snprintf(hello_str, count, "%s\n", buf);
    }    

    static struct kobj_attribute hello_attr = __ATTR_RW(hello);


    static int __init my_init(void)
    {
        test_kobj = kobject_create_and_add("test", NULL);
        if (test_kobj == NULL)
            printk(KERN_ERR "create koject failed!\n");  

        sysfs_create_file(test_kobj, &hello_attr.attr);

            printk(KERN_DEBUG "It works!\n");    /* missing semicolon */
            return 0;
    }

    static void __exit my_exit(void)
    {
        if (test_kobj != NULL) {
            sysfs_remove_file(test_kobj, &hello_attr.attr);
            kobject_put(test_kobj);
                printk(KERN_DEBUG "Goodbye!\n");
        }
            printk(KERN_DEBUG "Goodbye!\n");
    }

    module_init(my_init);
    module_exit(my_exit);
```

下面是演示效果
![Screenshot](image/5.png)

### kset

通过前面几个小节，我们基本上清楚了如何通过 kobject在sysfs创建目录以及文件，以及如何和用户态实现交互
内核还提供了一个上层抽象 kset，他的主要作用就是允许把多个kobject 以集合的形式 进行归类，他的定义很简单

```
    struct kset {
        struct list_head list;  // 集合中的kobject 通过entry 以链表串起来
        spinlock_t list_lock;  // 保护链表
        struct kobject kobj;  // kset自身也是一个kobj
        const struct kset_uevent_ops *uevent_ops; // 事件机制 当kset有kobj 加入和移除 可以触发事件
    } __randomize_layout;

    int kset_register(struct kset *k);
    void kset_unregister(struct kset *k);
    static struct kset *kset_create_and_add(const char *name,const struct kset_uevent_ops *uevent_ops,
                struct kobject *parent_kobj);
```

其实kset大部分接口 还是直接使用了kobject的接口

### 内核使用实例

本节，我们以分析xfs 对于kobject &sysfs 的使用，作为收尾

```
    #代码位置: fs/namespace.c：mnt_init
    #fs_kobj 会作为全局变量声明， fs是/sys/下面的顶级目录之一
    fs_kobj = kobject_create_and_add("fs", NULL);
```

上面代码完成了FS子系统在sysfs顶级目录下的创建 并通过 fs_kobj 宣告出去

```
    #代码位置: xfs/xfs_super.c：init_xfs_fs
    xfs_kset = kset_create_and_add("xfs", NULL, fs_kobj);
```

上面代码完成了/sys/fs/xfs目录的创建(以kset方式存在，父节点是fs_kobj)

接下来，我们仅以 xfs 目录下的extra作为举例

```
    #代码位置: xfs/xfs_super.c：init_xfs_fs
    xfs_extra_kobj.kobject.kset = xfs_kset; //设置了kobject的kset
    // 完成 extra kobj的初始化
    error = xfs_sysfs_init(&xfs_extra_kobj, &xfs_extra_ktype, NULL, "extra"); 
    // xfs_sysfs_init 就是掉了  kobject_init_and_add 
    xfs_sysfs_init
     - kobject_init_and_add
```

OK,EXTRA 目录是这样创建的，那么目录下面的文件是在哪里定义和创建的呢？
如果还记得之前内容，文件是通过attr attr_group创建的，有两种创建方法

- 通过ktype的defatult_attr 创建 
- 通过sysfs_create_file 创建

```
    .release = xfs_sysfs_release,
    .sysfs_ops = &xfs_sysfs_ops,
    .default_attrs = xfs_extra_attrs,

    STATIC ssize_t
    atomic_write_show(struct kobject *kobject, char *buf)
    {
        return snprintf(buf, PAGE_SIZE, "%d\n", xfs_globals.atomic_write);
    }
    XFS_SYSFS_ATTR_RO(atomic_write); // xfs 类似kobj_attribute 封装了attr 实现 ops重定向

    static struct attribute *xfs_extra_attrs[] = {
        ATTR_LIST(atomic_write),
        NULL,
    };

    struct kobj_type xfs_extra_ktype = {
        .release = xfs_sysfs_release,
        .sysfs_ops = &xfs_sysfs_ops,
        .default_attrs = xfs_extra_attrs,
    };
```