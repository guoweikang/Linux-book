## 日志系统

### 日志等级

内核内部定义了如下的日志等级 数字越小，表示等级越高

```
/* integer equivalents of KERN_<LEVEL> */
#define LOGLEVEL_SCHED          -2      /* Deferred messages from sched code
                                        * are set to this special level */
#define LOGLEVEL_DEFAULT        -1      /* default (or last) loglevel */
#define LOGLEVEL_EMERG          0       /* system is unusable */
#define LOGLEVEL_ALERT          1       /* action must be taken immediately */
#define LOGLEVEL_CRIT           2       /* critical conditions */
#define LOGLEVEL_ERR            3       /* error conditions */
#define LOGLEVEL_WARNING        4       /* warning conditions */
#define LOGLEVEL_NOTICE         5       /* normal but significant condition */
#define LOGLEVEL_INFO           6       /* informational */
#define LOGLEVEL_DEBUG          7       /* debug-level messages */
```

内核提供了两种日志打印方式:

- 内核缓冲区
- 控制台窗口,因为打印到窗口必须要频繁的触发类似于串口驱动，存在性能问题

更多关于内核缓冲区说明[参考](https://access.redhat.com/documentation/zh-cn/red_hat_enterprise_linux/8/html/managing_monitoring_and_updating_the_kernel/getting-started-with-kernel-logging_managing-monitoring-and-updating-the-kernel#what-is-the-kernel-ring-buffer_getting-started-with-kernel-logging)

printk子系统 提供了四个维度的日志等级配置:

- console_loglevel：控制台日志级别,优先级高于该值的消息将被打印至 **控制台**
- default_message_loglevel：缺省的消息日志级别,如果打印没有指定级别，则默认使用此级别
- minimum_console_loglevel: 最低的控制台日志级别，用户可以配置的最高级别
- default_console_loglevel: 缺省的控制台日志级别，如果打印没有指定级别，则默认使用此级别作为判断是否打印到 **控制台**的根据

```
int console_printk[4] = {
        CONSOLE_LOGLEVEL_DEFAULT,       /* console_loglevel */
        MESSAGE_LOGLEVEL_DEFAULT,       /* default_message_loglevel */
        CONSOLE_LOGLEVEL_MIN,           /* minimum_console_loglevel */
        CONSOLE_LOGLEVEL_DEFAULT,       /* default_console_loglevel */
};
```

### 日志等级配置

在用户态

- 通过`dmesg`调整控制台输出级别 `dmesg -n <loglevel>` 该修改只是修改控制台的日志级别
- 通过`boot`参数来修改 `loglevel=<level>` `log_buf_len` 动态调整日志缓冲区大小
- 通过sysctl 或者 `/proc/sys/kernel/printk` 设置日志等级

### 内核接口

`pr_info/debug/notice`

### 关于debug

内核关于`debug等级`日志有特殊处理，`console_loglevel`可以控制控制台的日志，但是不意味日志会被丢掉，日志会被保存在内核环形缓冲区，
依然可以通过dmesg查看 ,但是debug日志，必须要以显示的方式打开，才会被打印

```
#if defined(CONFIG_DYNAMIC_DEBUG) || \
    (defined(CONFIG_DYNAMIC_DEBUG_CORE) && defined(DYNAMIC_DEBUG_MODULE))
#define pr_debug(fmt, ...)                      \
        dynamic_pr_debug(fmt, ##__VA_ARGS__)
#elif defined(DEBUG)
#define pr_debug(fmt, ...) \
        printk(KERN_DEBUG pr_fmt(fmt), ##__VA_ARGS__)
#else
#define pr_debug(fmt, ...) \
        no_printk(KERN_DEBUG pr_fmt(fmt), ##__VA_ARGS__)
#endif
```

在没有支持 DYNAMIC_DEBUG之前，日过想要开启debug日志，必须在编译源文件的时候，增加 cflags += -DDEBUG，否则debug日志不会开启 
但是这种方式对于调试并不太方便，因此内核增加了 DYNAMIC_DEBUG能力，具体使用方法参考: [DYNAMIC_DEBUG能力](https://www.kernel.org/doc/html/latest/admin-guide/dynamic-debug-howto.html)

### 日志限速

限制日志打印频率，日志只能在指定时间内 打印不超过设定上线的日志条数，主要用于防范日志刷屏和攻击 
典型场景: 在某个函数，确实需要打印错误日志，但是该函数可能通过某种攻击手段 导致该函数在短时间内 不断重入，导致日志爆炸

#### 内核接口

在需要限速的日志地方 使用接口 printk_ratelimited

```
#define mfc_err_limited(fmt, args...)                   \
    do {                                            \
            printk_ratelimited(KERN_ERR "%s:%d: " fmt,      \
                   __func__, __LINE__, ##args);     \
        } while (0)
```

#### 限速参数设置

通过`sysctl` 或者 `/proc/sys/kernel/printk_ratelimit` 设置时间间隔 `/proc/sys/kernel/printk_ratelimit_burst` 设置该时间间隔内日志上限

### 其他功能

支持用户态写入kmesg

内核允许用户态通过 `/dev/kmsg` 向内核缓冲区写入日志，该选项可以通过 `/proc/sys/kernel/printk_devkmsg` 打开 关闭 或者 限速

打印延迟 `/proc/sys/kernel/printk_delay` 设置日志延迟，对日志进行降速处理

### 总结

- debug日志必须要主动开启才会打印

- 任何等级日志都会被打印到缓冲区

- 日志等级主要是用来配置允许串口输出的日志等级 
