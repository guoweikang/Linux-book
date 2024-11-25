## Filter Command

### 介绍

#### 回顾

我们在讲`dyn ftrace`设计和实现，其实涉及到了一部分本章节知识

可以通过使用`ftrace_set_filter/notrace` API，修改注册的`ftrace_ops`的黑白名单；

我们也对该`API`实际工作原理做了讲解；那么为什么还要单独在设置一个小节内容进行讲解呢？原因有几点： 

- `API`的使用形式是内核代码开发级别的设置，还有用户态接口的使用方法

- 内核不局限于 简单的函数过滤，还提供了`frace command`机制 

- 内核提供了大致统一的实现,不同的`ftrace`都可以使用，具有共性

### How To Use

#### tracefs文件接口

不同的`ftrace`模块会有不同的文件接口,比如 

- `stack_trace_filter`: `stack trace` 设置`filter`和 `command` 接口

- `set_ftrace_filter`: `function trace` 设置   `filter`和 `command` 接口

- `set_ftrace_notrace`:·`function trace`设置`nofilter`

- ...

无论是 `stack_trace_filter` 或者是`set_ftrace_filter` 由于内部机制实现一致，使用方法相同

#### 给指定函数插桩

这里以`set_ftrace_filter`举例 `stack_trace_filter`也一样

```shell
# echo "func_name" > /sys/kernel/tracing/set_ftrace_filter
# echo "func_name2" >> set_ftrace_filter // 追加
```

设置指定函数 不插桩 

```shell
# echo "func_name" > set_ftrace_notrace
```

设置指定函数 使能 `function graph tracer`

```shell
# echo __do_fault > set_graph_function   
# echo __do_fault > set_graph_notrace  
```

注意: `graph_function` 是基于`function trace`实现的，后面我们会讲，但是现在需要知道, `set_ftrace_filter`和` set_graph_function`会同时对`graph tracer`生效

#### command

除了上个小节的通过 `hash filter` 实现指定函数插桩之外， 还提供更高级的命令：

```shell
<function>:<command>:<parameter>
```

从命令形式，我们可以看到,命令是对`filter`的进一步延申，支持如下命令: 

- mod: 指定 `module `中匹配成功的函数过滤

- traceon/traceoff： 指定额外的 `traceon/off` 操作

- snapshot:指定额外的操作，copy 备份缓冲区

- enable/disable_event: 启用和关闭 event事件（event 子系统会在后续讲到）

##### mod

该命令用于启用每个模块的函数筛选。 参数定义了模块。

例如，仅对 `ext3` 模块中的 `write*` 函数插桩

```shell
echo 'write*:mod:ext3' > set_ftrace_filter
```

该命令与过滤器的交互方式与根据函数名过滤的方式相同。 因此，在过滤器文件中添加 (>>) 就可以在不同模块中添加更多的函数。 删除特定模块的功能时，在前面加上`！`：

```shell
echo '!write*:mod:ext3' >> set_ftrace_filter //移除ext3模块的`write*`插桩
echo '!*:mod:!ext3' >> set_ftrace_filter // 移除除了EXT3模块的所有函数插桩
echo '!*:mod:*' >> set_ftrace_filter // 移除所有模块的函数跟踪，但仍跟踪内核：
echo '*write*:mod:!*' >> set_ftrace_filter //为除所有模块以外(内核中)的write插桩
```

##### traceon/traceoff

这些命令会在指定函数被触发时打开或关闭跟踪系统。 参数决定了跟踪系统开启和关闭的次数。 如果未指定，则没有限制。 例如，在`__schedule_bug`前5次禁用跟踪，请运行

```shell
echo '__schedule_bug:traceoff:5' > set_ftrace_filter
echo '__schedule_bug:traceoff' > set_ftrace_filter //当__schedule_bug 被触发时，始终禁用跟踪：
```

##### snapshot

`snapshot` : 在触发该函数时触发快照。

```shell
echo 'native_flush_tlb_others:snapshot' > set_ftrace_filter
```

##### enable_event/disable_event

 这些命令可以启用或禁用跟踪事件。 请注意，由于函数跟踪回调非常敏感，因此在注册这些命令时，跟踪点会被激活，但会以 "软 "模式禁用。 也就是说，跟踪点会被调用，但不会被跟踪。 只要有命令触发，事件跟踪点就会保持这种模式。

```
<function>:enable_event:<system>:<event>[:count]
<function>:disable_event:<system>:<event>[:count]
```

- **`<function>`**：需要跟踪的函数。
- **`enable_event` / `disable_event`**：指定启用或禁用的事件命令。
- **`<system>`**：事件所属的系统或子系统（如 `sched`、`irq` 等）。
- **`<event>`**：具体的事件名称（如 `sched_switch`、`try_to_wake_up` 等）。
- **`[:count]`**（可选）：指定命令生效的调用次数。

更多使用相关内容 请参考 [ftrace](https://www.kernel.org/doc/Documentation/trace/ftrace.txt)

### How To Implement

#### trace_fs_create

这是`set_ftrace_filter`的创建

```c
ftrace_create_filter_files(&global_ops, d_tracer);
void ftrace_create_filter_files(struct ftrace_ops *ops,
                                  struct dentry *parent)
  {       
          trace_create_file("set_ftrace_filter", TRACE_MODE_WRITE, parent,
                            ops, &ftrace_filter_fops);
          trace_create_file("set_ftrace_notrace", TRACE_MODE_WRITE, parent,
                            ops, &ftrace_notrace_fops);
  }
```

这是 `stack_trace_filter`的创建

```c
trace_create_file("stack_trace_filter", TRACE_MODE_WRITE, NULL,
                            &trace_ops, &stack_trace_filter_fops);
```

由于`function tracer` 会涉及到我们还没有讲到的内容，这里我们主要以 `stack_trace_filter` 分析, 在创建该文件时，会传入

- trace_ops: 对应的`ftrace ops` 

- `stack_trace_filter_fops`：文件操作回调

重点分析 `stack_trace_filter_fops`: 

```c
static const struct file_operations stack_trace_filter_fops = {
          .open = stack_trace_filter_open,
          .read = seq_read,
          .write = ftrace_filter_write,
          .llseek = tracing_lseek,
          .release = ftrace_regex_release,
};
```

#### 输入不包括`:`字符

第一种使用方法，如果不包含`：` ，也就是只是单纯的 设置黑白名单

```c
ftrace_filter_write
 -> ftrace_regex_write(file, ubuf, cnt, ppos, 1);
  -> ftrace_process_regex 
    -> ftrace_match_records() 
```

`ftrace_match_records`：参考之前的`ftrace_set_filter ` 实现

```c
ftrace_regex_release 
 -> ftrace_hash_move_and_update_ops()
```

`ftrace_hash_move_and_update_ops`： 参考之前的`ftrace_set_filter` 实现

可以看到，此逻辑下，过程和`ftrace_set_filter` 类似

#### command

如果使用了`function:command：xxx` 表示使用子命令

```c
ftrace_filter_write
 -> ftrace_regex_write(file, ubuf, cnt, ppos, 1);
  -> ftrace_process_regex 
    -> 遍历 ftrace_commands 
     -> 如果command 匹配，执行对应的ftrace_func_command
      -> ftrace_func_command(tr, hash,func,cmd,params, enable)
```

因此，支持哪些`command`取决于 `ftrace_comands`注册了哪些

##### struct ftrace_func_command

核心结构体 `ftrace_func_command`

```c
  struct ftrace_func_command {
          struct list_head        list;
          char                    *name; // comand name
          int                     (*func)(struct trace_array *tr,
                                          struct ftrace_hash *hash,
                                          char *func, char *cmd,
                                          char *params, int enable);
  };
```

##### register_ftrace_command

command注册接口

```c
__init int register_ftrace_command(struct ftrace_func_command *cmd)
```

##### mod command

```c
 static struct ftrace_func_command ftrace_mod_cmd = {
          .name                   = "mod",
          .func                   = ftrace_mod_callback,
  };
```

可以知道，核心就在于  `ftrace_mod_callback` 实现逻辑, 在看代码之前，我们先回顾一下`mod command`是为了实现什么功能?  

支持针对某个`module` 的`func`  打桩，也就是 `filter func`的高级版本 

我们已经知道`dyn trace record`是函数级别的，并没有`module`的结构，如果是你，你准备如何实现这个功能？ 先思考一下？ 

整理思路：

- 打桩点：可以插桩的代码位置信息

- 打桩点被记录在 `dyn ftrace records` 一个全局数组中

- 插桩点代码实现在某个`module`中，我们就说该插桩点位于 属于某个`module`

```c
ftrace_mod_callback(tr, hash,func_orig,cmd, module, enable) 
   // 筛选符合条件的records放入hash表
  -> match_records(hash, func, strlen(func), module); 
    -> for each record  
       // 筛选符合条件的records
      -> ftrace_match_record(rec, &func_g, mod_match, exclude_mod))
           // 遍历并获取当前rec所属的module 
          -> lookup_ip(rec->ip, &modname, str) 
           // 判断rec 是否在module 中并且属于当前module 
          -> mod_match = (modname) ? ftrace_match(modname, mod_g) : 0;
           //继续判断function是否匹配
          -> ftrace_match(str, func_g);
  // 如果存在符合条件的records 继续执行
  -> cache_mod(tr,func,module,enable) 
         //设置白名单(enable = 1)
          -> head = tr->mod_trace 
         // 设置黑名单
          -> head = tr-> mod_notrace 
         // 如果是 ！释放
          -> free_ftrace_mod()
         // 否则添加
          -> ftrace_add_mod(tr,func,module,enable)
```

通过代码，可以分析得到,`mod command` 维护模块跟踪名单 主要通过 一个 `mod_trace`  

该链表`node`结点结构体为

```c
  struct ftrace_mod_load {     
          struct list_head        list;
          char                    *func;  
          char                    *module;
          int                      enable;
  };

  如果执行`echo write*:mod:ext3` 则会创建一个如下的node
  f_mod {
      func = "write*";
      module = "ext3";
      enable = 1;
  }
```

到目前我们可以得到两个结果

- iter->hash : 会把匹配到的`record entry` 塞进去 
- 会把匹配啊到的`frace_mod_load` 放到`tr->mod_trace`

第一个，就和`filter`一样，在` ftrace_regex_release` 文件关闭时，会更新插桩点；

第二个，是因为可能有module当前未加载，需要保存下过滤信息，在moudle加载的时候过滤插桩，具体流程在下面代码中

```c
ftrace_module_enable(mod)
 -> process_cached_mods(mod->name)
   -> for ftrace_trace_arrays 遍历TR
    -> process_mod_list(&tr->mod_trace, tr->ops, mod, true); 
      -> 遍历 mod_trace
       ->  匹配`mod_trace`中的func records 添加到对应的 tr->ops
         // 更新records插桩
        ->ftrace_hash_move_and_update_ops()
```

其他`command`过程我们暂时先不关注了
