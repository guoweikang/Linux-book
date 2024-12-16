## kernel Param

```json
"node" {
    "label": "kernel param",
    "categories": ["config"],
    "info": "kernel and module param",
    "depends": [
          "kernel start",
          "boot config",
          "initcall",
          "kernel taint",
          "kernel security",
          "procfs",
          "sysfs",
          "kernel module"
    ]
}
```

### 介绍

内核提供给各个模块注册参数接口，这些参数会在编译链接阶段存放在内核代码中，内核在启动各个子系统之前，通过对比用户传入的`command line`  选项 系统注册的参数进行匹配，一旦匹配成功，则调用对应参数设置的回调设置函数，完成对应模块参数的配置

`kernel param`  是内核当前主要在使用的机制，相比较于 `obsolate param`，功能更加完善且复杂

### 内核实现

#### __start___param 代码段

内核在代码里预留了一个段，被`__param`标识的变量, 会被链接在`__start___param`和`__stop___param`之间

```c
 __start___param = .; 
 KEEP(*(__param)) 
 __stop___param = .; }
```

#### struct kernel_param

```c
struct kernel_param_ops {
          /* How the ops should behave */
          unsigned int flags;
          /* Returns 0, or -errno.  arg is in kp->arg. */
          int (*set)(const char *val, const struct kernel_param *kp);
          /* Returns length written or -errno.  Buffer is 4k (ie. be short!) */
          int (*get)(char *buffer, const struct kernel_param *kp);
          /* Optional function to free kp->arg when module unloaded. */
          void (*free)(void *arg);
  };
  /* Special one for strings we want to copy into */
  struct kparam_string {
          unsigned int maxlen;
          char *string;
  };

  /* Special one for arrays */
  struct kparam_array
  {
          unsigned int max;
          unsigned int elemsize;
          unsigned int *num;
          const struct kernel_param_ops *ops;
          void *elem;
  };

   struct kernel_param {       
          const char *name; 
          struct module *mod;
          const struct kernel_param_ops *ops;
          const u16 perm;
          s8 level;    
          u8 flags;    
          union {      
                  void *arg;
                  const struct kparam_string *str;
                  const struct kparam_array *arr; 
          };
  };
```

此结构体，相较于`obsolete param` 可以看到有了更加复杂的字段，这些字段表明 此参数机制 拥有更加丰富的功能 

- mod: 说明`param`支持 `module` 

- ops:更加复杂和完整的参数操作接口 
  
  - flags: 
    
    - KERNEL_PARAM_OPS_FL_NOARG : 表示选项无参数(可以用于Bool)

- perm： `sysfs` 对应的文件权限(读写和访问权限) , `0`  表示不在sysfs显示

- flags: 
  
  - KERNEL_PARAM_FL_UNSAFE: 危险参数，会污染内核
  
  - HWPARAM:  受`LOCKDOWN_MODULE_PARAMETERS` 权限管控

- level： 对应 `initcall` 机制里的不同等级

- arg:  参数内容

#### type

 内核提供了一些基础的类型，以及对应的`ops`,使用基础类型的模块，按需调用对应的接口，目前提供的有： 

- byte, hexint, short, ushort, int, uint, long, ulong
- charp: a character pointer
- bool: a bool, values 0/1, y/n, Y/N.
- invbool: the above, only sense-reversed (N = true).

这些类型，都提供了固固定类型的既定实现

- `int param_set_[type] (const char *val, const struct kernel_param *kp); `

- `int param_get_[type] (char *buffer, const struct kernel_param *kp);`

- `struct kernel_param_ops param_ops_[type]`

#### API : core_param

接下来 我们会分析不同 `param`的API 以及解释他们的不同

```c
#define core_param(name, var, type, perm) 
```

- name： 参数名

- var:  arg 参数对应的value 设置变量的内存

- type: arg 的类型
  
  - byte, hexint, short, ushort, int, uint, long, ulong
  - charp: a character pointer
  - bool: a bool, values 0/1, y/n, Y/N.
  - invbool: the above, only sense-reversed (N = true).

- perm: `sysfs` 对应的文件权限(读写和访问权限) , `0` 表示不在`sysfs`显示

我们直接给出最终宏展开的一个示例

```c
static int pause_on_oops;
core_param(pause_on_oops, pause_on_oops, int, 0644);
//-----------------------------------------------
//用于编译阶段检查传入变量类型是否一致
static unsigned int *__check_pause_on_oops(void) { 
           return &pause_on_oops; 
}
static const char __param_str_pause_on_oops[] = "pause_on_oops"; 
static struct kernel_param _param_pause_on_oops
 __used __section("__param")    
  = 
{
   __param_str_pause_on_oops, 
   THIS_MODULE, 
   &param_ops_int,
   0664,
   -1,
   0, 
   { &pause_on_oops } 
}
```

 最主要的特点在于  通过此接口定义的结构体

- level  = -1;

- 参数名称等于实际的设置的名称(不包含 `module name` ),参数属于`kernel`

#### API : device(subsys/core)_param_cb

此类API 格式类似, 主要用于在不同的`initcall`  调用阶段的初始化

```c
 #define late_param_cb(name, ops, arg, perm)             \
          __level_param_cb(name, ops, arg, perm, 7)
```

不同的接口 对应不同的`level` ，最终展开为

```c
  static const struct kernel_param_ops loop_hw_qdepth_param_ops = {
          .set    = loop_set_hw_queue_depth,
          .get    = param_get_int,
   };
  static int hw_queue_depth = LOOP_DEFAULT_HW_Q_DEPTH;
  device_param_cb(hw_queue_depth, &loop_hw_qdepth_param_ops, &hw_queue_depth, 0444);
//------------------------------------------------------------------
static const char __param_str_hw_queue_depth[] = "loop.hw_queue_depth"; 
static struct kernel_param _param_hw_queue_depth
 __used __section("__param")    
  = 
{
   __param_str_hw_queue_depth, 
   THIS_MODULE, 
   &loop_hw_qdepth_param_ops,
   0444,
   devic_level = 6 ,
   0, 
   { &hw_queue_depth } 
}
```

接口特点，通过此接口定义的 结构体

- `level`等于`initcall`中对应的级别

- 参数名称： 
  
  - 如果代码被直接编译进内核，变量名称为: `modname.param_name` ,参数属于具体模块
  
  - 如果是以模块的形式加载，则表示以`module`的方式加载

#### API :module_param

```c
#define module_param(name, type, perm)
  module_param_named(name, name, type, perm)   
```

- name： 参数名

- type:  arg 的类型
  
  * byte, hexint, short, ushort, int, uint, long, ulong
  * charp: a character pointer
  * bool: a bool, values 0/1, y/n, Y/N.
  * invbool: the above, only sense-reversed (N = true).

- perm: `sysfs` 对应的文件权限(读写和访问权限) , `0` 表示不在sysfs显示

这里和之前大部分相同，主要区别为： 

- 增加了 `__MODULE_INFO`描述

- level = -1 

- 参数名称：
  
  - 如果代码被直接编译进内核，变量名称为: `modname.param_name` ,参数属于具体模块
  
  - 如果是以模块的形式加载，则表示以`module`的方式加载

#### boot阶段的参数匹配

boot阶段，会对 链接到内核的参数进行解析 一共有两处 

第一处 对应 `level=-1`的初始化 

```c
start_kerne()
   // 初始化所有level  = -1 的 参数 
          after_dashes = parse_args("Booting kernel",
                                    static_command_line, __start___param,
                                    __stop___param - __start___param,
                                    -1, -1, NULL, &unknown_bootoption);
          print_unknown_bootoptions();
```

第二处 在 `initcall` 模块在调用各个`initcall`之前设置

```c
  static void __init do_initcall_level(int level, char *command_line)
  {
          initcall_entry_t *fn;

          parse_args(initcall_level_names[level],
                     command_line, __start___param,
                     __stop___param - __start___param,
                     level, level,
                     NULL, ignore_unknown_bootoption);

          trace_initcall_level(initcall_level_names[level]);
          for (fn = initcall_levels[level]; fn < initcall_levels[level+1]; fn++)
                  do_one_initcall(initcall_from_entry(fn));
  }
```

#### module模式

如果代码被编译成模块，则` kernel param` 并不会被链接，所以对应的参数不会再`start_param`段里面 ，而是再模块加载的时候，才会被扫描加载

下面代码是段的变量扫描

```c
static int find_module_sections(struct module *mod, struct load_info *info)
  {       
          mod->kp = section_objs(info, "__param",
                                 sizeof(*mod->kp), &mod->num_kp);
```

在module 加载时 才解析参数

```c
/* Module is ready to execute: parsing args may do that. */
after_dashes = parse_args(mod->name, mod->args, mod->kp, mod->num_kp,
                                    -32768, 32767, mod,
                                    unknown_module_param_cb);
```

module的参数传递格式为

```shell
# modeprobe test_mod test_param=1
```

#### sysfs

一旦为`kernel param`设置了非0的 `perm`选项的，都会生成对应的`sysfs`用户接口 

```c
device_param_cb(hw_queue_depth, &loop_hw_qdepth_param_ops, &hw_queue_depth, 0444);
```

会再对应的sysfs节点创建parameter，不属于任何模块的,也就内核的kernel param会在`kernel module`目录下 

```shell
# cat /sys/module/[module]/parameters/xxx
# cat /sys/module/kernel/parameters/xxx
```

如果对应文件具备写权限，则还可以修改

`sysfs` 初始化在这里，比较简单 我们就不再跟踪了

```c
  /*      
   * param_sysfs_builtin_init - add sysfs version and parameter
   * attributes for built-in modules
   */
  static int __init param_sysfs_builtin_init(void)
  {
          if (!module_kset)
                  return -ENOMEM;

          version_sysfs_builtin();
          param_sysfs_builtin();

          return 0; 
  }               
  late_initcall(param_sysfs_builtin_init);
```
