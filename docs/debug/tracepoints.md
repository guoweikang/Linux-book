## Tracepoints

上一个小节，我们介绍了`dyn ftrace`的实现细节 以及 使用方法，本小节 我们依然从 使用者 和 设计者的角度来学些内核的 `tracepoints`

参考资料： 

- [Using the Linux Kernel Tracepoints &mdash; The Linux Kernel documentation](https://kernel.org/doc/html/v6.1/trace/tracepoints.html)

- [Using the TRACE_EVENT() macro (Part 1) [LWN.net]](https://lwn.net/Articles/379903/)

- [Using the TRACE_EVENT() macro (Part 2) [LWN.net]](https://lwn.net/Articles/381064/)

- [Using the TRACE_EVENT() macro (Part 3) [LWN.net]](https://lwn.net/Articles/383362/)

 

### 需求定义

还是要先回顾一下 `dyn ftrace`实现了哪些功能，才能更好理解 `tracepoints`希望解决的是什么问题，他们的区别在哪里 

`dyn trace`的功能

- `dyn ftrace`是在编译时 在函数内部预留了  打桩函数的位置

- 内核统一管理了 所有可以 加入打桩函数的   位置信息(`dyn trace`)

- 内核统一管理了 所有打桩函数 `trace_ops`

- 通过 `func filter` 可以只给特定的 `dyn trace`   注入 打桩函数 

- 内核提供了一些 打桩函数 `function（graph） tracer ` `stack tracer`  和用户配置文件(`tracefs/set_ftrace_filter`等 )

- 支持用户自己实现`打桩函数` 

`dyn trace`的优点： 

- 动态`ftrace ` 在运行时 并且关闭状态下 开销几乎为0 

`dyn trace`的局限性：

- 插入位置在编译时确定 ，一般只能是函数开始

- 每次增加打桩函数，都需要实现一套对应用户态的配置文件 

- 插桩的函数支持范围很大，是优点也是缺点

- 由于上述2个原因，如果希望只针对某些函数或者子系统 定制回调 `trace` 代价比较大，一般只有在一些全局比较common的`trace`时会用到，比如 `stack tracer` 



回到我们在一开始`tracing`中描述的原始需求：

- 可以在内核代码的任意位置中插入钩子函数
- 钩子函数可以获得当前上下文内容(函数、参数、变量)
- 钩子函数可以动态的`enable/disable` 



很明显，`dyn trace` 无法完整实现 第1和第2需求 ，  `tracepoints`可以解决此需求



### As a  User

我们先把自己角色定义为使用者，



### As a kernel Developer & Designer

我们这里作为1个普通的内核开发者，如何使用 `tracepoints` 能力在我们自己的内核，

以及 `tracepoints` 具体的实现和设计

#### 核心结构:  tracepoint 定义

```c
  struct tracepoint {
          const char *name;               /* Tracepoint name */
          struct static_key key;
          struct static_call_key *static_call_key;
          void *static_call_tramp;
          void *iterator;
          void *probestub;
          int (*regfunc)(void);
          void (*unregfunc)(void);
          struct tracepoint_func __rcu *funcs;
  };

```

这里我们关注`funcs` 他是一个数组， 每个 `tracepoint` 允许注册多个回调函数



#### 使用声明宏定义: tracepoint

首先 需要定义 `tracepoint` ，定义需要单独头文件定义，路径一般为 `include/trace/events/subsys.h`  一般内容格式为 ： 

```c
#undef TRACE_SYSTEM
#define TRACE_SYSTEM subsys

#if !defined(_TRACE_SUBSYS_H) || defined(TRACE_HEADER_MULTI_READ)
#define _TRACE_SUBSYS_H

#include <linux/tracepoint.h>

DECLARE_TRACE(subsys_eventname,
        TP_PROTO(int firstarg, struct task_struct *p),
        TP_ARGS(firstarg, p));

DECLARE_TRACE(subsys_eventname2,
        TP_PROTO(int firstarg, struct task_struct *p),
        TP_ARGS(firstarg, p));

#endif /* _TRACE_SUBSYS_H */

/* This part must be outside protection */
#include <trace/define_trace.h>
```

可以看到，不像传统的头文件 以下面的格式开始

```c
#ifdef __SUBSYS_H
#define __SUBSYS_H
```

原因在于除了正常的`头文件自包含`之外， 还需要解决 不同`subsys` 头文件互相引用的问题,下面两行用于声明在一个新的 `subsys`定义之中



- `subsys`: 会对应 `/sys/kernel/tracing/events/subsys` 用来把同一个子系统的`tracepoints`进行归类管理

- `#include <linux/tracepo` ：这个很重要，该头文件中的内容 关乎  `tracepoints` 相关宏的定义
  
  

##### DECLARE_TRACE

```c
 #define DECLARE_TRACE(name, proto, args)                                \
          __DECLARE_TRACE(name, PARAMS(proto), PARAMS(args),              \
                          cpu_online(raw_smp_processor_id()),             \
                          PARAMS(void *__data, proto))    
 

  #define __DECLARE_TRACE(name, proto, args, cond, data_proto)            \
          extern int __traceiter_##name(data_proto);                      \
          DECLARE_STATIC_CALL(tp_func_##name, __traceiter_##name);        \
          extern struct tracepoint __tracepoint_##name;                   \
          static inline void trace_##name(proto)                          \
          {                                                               \
                  if (static_key_false(&__tracepoint_##name.key))         \
                          __DO_TRACE(name,                                \
                                  TP_ARGS(args),                          \
                                  TP_CONDITION(cond), 0);                 \
                  if (IS_ENABLED(CONFIG_LOCKDEP) && (cond)) {             \
                          WARN_ON_ONCE(!rcu_is_watching());               \
                  }                                                       \
          }                                                               \
          __DECLARE_TRACE_RCU(name, PARAMS(proto), PARAMS(args),          \
                              PARAMS(cond))    
           static inline int                                               \
          register_trace_##name(void (*probe)(data_proto), void *data)    \
          {                                                               \
                  return tracepoint_probe_register(&__tracepoint_##name,  \
                                                  (void *)probe, data);   \
          }                                                               \
          static inline int                                               \
          register_trace_prio_##name(void (*probe)(data_proto), void *data,\
                                     int prio)                            \
          {                                                               \
                  return tracepoint_probe_register_prio(&__tracepoint_##name, \
                                                (void *)probe, data, prio); \
          }                                                               \
          static inline int                                               \
          unregister_trace_##name(void (*probe)(data_proto), void *data)  \
          {                                                               \
                  return tracepoint_probe_unregister(&__tracepoint_##name,\
                                                  (void *)probe, data);   \
          }                                                          static inline void                                              \
          check_trace_callback_type_##name(void (*cb)(data_proto))        \
          {                                                               \
          }                                                               \
          static inline bool                                              \
          trace_##name##_enabled(void)                                    \
          {                                                               \
                  return static_key_false(&__tracepoint_##name.key);      \
          }


```



- 声明了 一个函数指针:   `int __traceiter_##name(data_proto)`

- 声明了一个结构体: `struct static_call_key __SCK_tp_func__##name`  

- 声明了一个函数指针: `_SCT__tp_fucn__##name` 类型等于 第一个

- 声明了一个结构体: `struct tracepoint __tracepoint_##name`

- 定义一个函数: `staic inline void trace__##name(proto)` 入参等于 `proto`

- 定义了几个注册函数: `unregister/register_trace_(prio)_##name`



最重要的在于 定义了 `trace_##name` 函数，他就是我们所说的 `tracepoints` 回调函数总的入口 ，但是它里面使用到了 结构体`*_tracepoint*##name`，此使我们其实并没有声明出此结构体，因此 如果希望使用 还需要 额外的定义

#### DEFINE_TRACE

在我们需要使用 `trace_##name`函数的源文件 添加如下代码

```c
#include <trace/events/subsys.h> //我们之前自己定义的头文件

#define CREATE_TRACE_POINTS  // 非常重要
DEFINE_TRACE(subsys_eventname);

void somefct(void)
{
        ...
        trace_subsys_eventname(arg, task); //在希望trace的地方调用函数
        ...
}
```



```c
  #define DEFINE_TRACE(name, proto, args)         \
          DEFINE_TRACE_FN(name, NULL, NULL, PARAMS(proto), PARAMS(args))
  ; 
   #define DEFINE_TRACE_FN(_name, _reg, _unreg, proto, args)               \
          static const char __tpstrtab_##_name[]                          \
          __section("__tracepoints_strings") = #_name;                    \
          extern struct static_call_key STATIC_CALL_KEY(tp_func_##_name); \
          int __traceiter_##_name(void *__data, proto);                   \
          void __probestub_##_name(void *__data, proto);                  \
          struct tracepoint __tracepoint_##_name  __used                  \
          __section("__tracepoints") = {                                  \
                  .name = __tpstrtab_##_name,                             \
                  .key = STATIC_KEY_INIT_FALSE,                           \
                  .static_call_key = &STATIC_CALL_KEY(tp_func_##_name),   \
                  .static_call_tramp = STATIC_CALL_TRAMP_ADDR(tp_func_##_name), \
                  .iterator = &__traceiter_##_name,                       \
                  .probestub = &__probestub_##_name,                      \
                  .regfunc = _reg,                                        \
                  .unregfunc = _unreg,                                    \
                  .funcs = NULL };                                        \
          __TRACEPOINT_ENTRY(_name);                                      \  
          int __traceiter_##_name(void *__data, proto)                    \
          {                                                               \
                  struct tracepoint_func *it_func_ptr;                    \
                  void *it_func;                                          \
                                                                          \
                  it_func_ptr =                                           \
                          rcu_dereference_raw((&__tracepoint_##_name)->funcs); \
                  if (it_func_ptr) {                                      \
                          do {                                            \
                                  it_func = READ_ONCE((it_func_ptr)->func); \
                                  __data = (it_func_ptr)->data;           \
                                  ((void(*)(void *, proto))(it_func))(__data, args); \
                          } while ((++it_func_ptr)->func);                \
                  }                                                       \
                  return 0;                                               \
          }                                                               \
          void __probestub_##_name(void *__data, proto)                   \
          {                                                               \
          }                                                               \
          DEFINE_STATIC_CALL(tp_func_##_name, __traceiter_##_name);


```

- 真正定义了 `tracepoint` ： `struct tracepoint *_tracepoint*##_name` 

- 完成了 `tracepoint`初始化：
  
  -  `name = *_tpstrtab##_name`,
  
  - `static_key key  = false`
  
  - `static_call_key = SCK_tp_func_##name`
  
  -  `static_call_tramp = SCT_tp_func_##name`
  
  - `iterator  = _traceiter_##name`
  
  - `reg = NULL`
  
  - `unreg = NULL`
  
  - `funcs = NULL`

- 定义了 `__traceiter_##_name` 函数的实现

- 定义了 `struct static_call_key SCK_tp_func_##name` 
  
  - `func = _traceiter##_name`
  
  - `type =1`
  
  

#### trace_##_name

现在，我们声明了`tracepoints` 并且也在源文件中定义了 `tracepoints `,如果源文件中 调用 `trace_##name` 到底发生了什么 ？ 我们继续深入一下 该函数的实现

首先，该函数的定义是在 `DECLARE_TRACE`中 定义的 

```c
static inline void trace_##name(proto)                          \
{                                                               \
    if (static_key_false(&__tracepoint_##name.key))         \
        C(name,                                \
                   TP_ARGS(args),                          \
                   TP_CONDITION(cond), 0);                 \
    if (IS_ENABLED(CONFIG_LOCKDEP) && (cond)) {             \
                    WARN_ON_ONCE(!rcu_is_watching());               \
     }                                                       \
}  
```

很明显，首先需要判断 `*_tracepoint*##name.key` 



```c
#ifdef CONFIG_HAVE_STATIC_CALL
  #define __DO_TRACE_CALL(name, args)                                     \
          do {                                                            \
                  struct tracepoint_func *it_func_ptr;                    \
                  void *__data;          /                                 \
                  it_func_ptr =                                           \
                          rcu_dereference_raw((&__tracepoint_##name)->funcs); \
                  if (it_func_ptr) {                                      \
                          __data = (it_func_ptr)->data;                   \
                          static_call(tp_func_##name)(__data, args);      \
                  }                                                       \
          } while (0)
  #else
  #define __DO_TRACE_CALL(name, args)     __traceiter_##name(NULL, args)
  #endif /* CONFIG_HAVE_STATIC_CALL */


```

然后会根据平台 x86 遍历 `funcs` 执行 `tp_func_##name` 或者 执行 `_traceiter_##name(NULL, args)`，回顾他的定义，可以看到 就是遍历 `funcs` 执行回调函数





#### tracepoint_probe_register[_prio]

此函数 用于注册`probe` 函数到`tracepoints`

```c
tracepoint_probe_register_prio(struct tracepoint *tp, void *probe, void *data, int prio)
 -> tracepoint_add_func(tp, tp_func, prio) 
  ->  tp->regfunc()
  ->  func_add() : 更新 tp->funcs
  ->  tracepoint_update_call(tp, tp_funcs): 更新回调函数
```




