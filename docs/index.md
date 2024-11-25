# 介绍

这是我自己的Linux book，为了组织我自己的学习知识图谱

<iframe src="static/datamap/index.html" style="width: 100%; height: 900px; border: none;"></iframe>

## 代码编写规范

本节将研究编码过程。我们将首先了解内核开发人员可能出错的多种方式。然后重点将转向正确做事以及有助于实现这一目标的工具。

### 编码风格

强烈建议遵循内核编码风格，实际上还有很多工具可以帮助我们完成格式化工作，但是请习惯他

[参考](https://docs.kernel.org/process/coding-style.html#codingstyle)

### ifdef使用

#ifdef 建议应该尽可能限制在头文件，条件编译的代码建议限制为函数

### 锁

任何可以被多个线程同时访问的资源（数据结构、硬件寄存器等）都必须受到锁的保护。编写新代码时应牢记这一要求；
事后改造锁定是一项相当困难的任务。内核开发人员应该花时间充分了解可用的锁定原语，
以便为工作选择正确的工具。缺乏对并发性关注的代码将很难进入主线。

### clang-format

内核已经默认在主线提供了符合linux内核编码的clang-format

#### 安装:

```
    $ sudo dnf install -y clang-tools-extra
```

#### 使用

clang-format 详细使用说明 参考: 

- https://clang.llvm.org/docs/ClangFormat.html 
- https://clang.llvm.org/docs/ClangFormatStyleOptions.html

检查文件和补丁的编码风格: -i 会直接修改文件，不加-i 只是预览

```
    $ clang-format -i kernel/*.[ch]
```

clang-format 对于内核代码风格 缺少一些支持，比如下面的对齐格式

```
    $ clang-format -i kernel/*.[ch]

    #define TRACING_MAP_BITS_DEFAULT       11
    #define TRACING_MAP_BITS_MAX           17
    #define TRACING_MAP_BITS_MIN           7
```

会被修改为: 

```
    #define TRACING_MAP_BITS_DEFAULT 11
    #define TRACING_MAP_BITS_MAX 17
    #define TRACING_MAP_BITS_MIN 7
```

```
    $ clang-format -i kernel/*.[ch]

    static const struct file_operations uprobe_events_ops = {
        .owner          = THIS_MODULE,
        .open           = probes_open,
        .read           = seq_read,
        .llseek         = seq_lseek,
        .release        = seq_release,
        .write          = probes_write,
    };
```

会被修改为: 

```
    static const struct file_operations uprobe_events_ops = {
        .owner = THIS_MODULE,
        .open = probes_open,
        .read = seq_read,
        .llseek = seq_lseek,
        .release = seq_release,
        .write = probes_write,
    };
```

### 编译告警的启用

请注意，并非所有编译器警告都默认启用。使用“make KCFLAGS=-W”构建内核以开启。

### FRAME_WARN的使用

Linux 内核线程会分分配 4Kb或者8Kb的栈 通过设置 CONFIG_FRAME_WARN 可以在编译阶段帮助我们发现 函数实现 是否可能超出了栈大小

### DEBUG_OBJECTS的使用

DEBUG_OBJECTS 可以用来检查 内核创建的各种对象的生命周期，并在使用出现混乱是 发出告警，如果我们正在写一个模块，并且涉及到对象的管理，可以尝试添加对象调试
更多信息参考 :ref:`debugobjects`

内核提供了几个打开调试功能的配置选项；其中大部分可以在“kernel hacking”子菜单中找到。对于用于开发或测试目的的任何内核，应打开其中几个选项。特别是：

- 获取大于给定数量的堆栈帧的警告。生成的输出可能很详细，但不必担心来自内核其他部分的警告 
- 将添加代码来跟踪内核创建的各种对象的生命周期，并在事情发生混乱时发出警告。如果您要添加一个创建（并导出）自己的复杂对象的子系统，
  请考虑添加对对象调试基础结构的支持。