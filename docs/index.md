# 介绍

这是我自己的Linux book，为了组织我自己的学习知识图谱，每章(每个模块)的安排是这样的：

- 理论基础:  涵盖操作系统对应基础、硬件相关特性
- Linux设计: Linux 对于该模块的宏观设计，核心结构组织
- 代码: 核心代码、关键算法、优秀实践走读
- API ：该模块涉及到的核心和对外API
- 工具：该模块涉及到的 性能、使用分析工具的使用方法

前置课程: 计算机原理 操作系统原理

本章作为Linux的一个前置介绍，为了保证后续章节的连续性，主要包含: 

- Linux开发环境
- Linux开发指导

## 内核版本

本节过后，应该清楚

- 内核版本号x.y.z的含义，能够描述稳定版本发布，rc版本，稳定版本的维护版本
- 内核版本号对应的特性&修复补丁开发周期
- 内核长期版本

自1990年Linux内核项目成立，迄今为止，无论是用户还是开发者，已经非常庞大，一两个人开发和一两千人开发，完全是不同的概念，所以社区在内核代码管理运作上不得不投入一些精力维护，一个良好的版本管理是必不可少的

内核按照A.B 每个B版本都是内核的主要版本，主要版本里面又包含了 rc版本和稳定版本，下表列出的是内核每个稳定版本发布的示例

| 版本  | 发布时间     |
| --- | -------- |
| 5.0 | 19.3.3   |
| 5.1 | 19.5.5   |
| 5.2 | 19.7.7   |
| 5.3 | 19.9.15  |
| 5.4 | 19.11.24 |
| 5.5 | 20.1.6   |

每个 5.x 版本都是主要内核版本，具有新功能、内部 API 更改等。一个典型的版本可以包含大约 13,000 个变更集，其中更改了数十万行代码。5.x是Linux内核开发的前沿；内核使用滚动开发模型，不断集成重大更改。

**注意**

   关于5.x 和 6.x，很多人想 5和6是不是有特别大区别，ok,答案是并不会，只是当点后面的数字开始看起来“太大”时，主版本号就会递增。确实没有其他原因。

可以看到，一个5.x版本间隔大约是2-3个月，这两到三个月又分为  

- 合并窗口(大约2周): 
   每个版本的补丁合并遵循相对简单的规则。在每个开发周期开始时，“合并窗口”是打开的，那时，被认为足够稳定（并且被开发社区接受）的代码被合并到主线内核中。新开发周期的大部分变更（以及所有主要变更）将在此期间合并，速度接近每天 1,000 个变更（“补丁”或“变更集”）,顺便说一句，合并窗口期间集成的更改并不是凭空而来的；它们是提前收集、测试和暂存的。
   合并窗口持续大约两周。在此时间结束时，Linus Torvalds 将声明窗口已关闭并释放第一个“rc”内核。例如，对于预定为 5.6 的内核，在合并窗口结束时发生的发布将被称为 5.6-rc1。-rc1 版本是合并新功能的时间已经过去的信号，并且稳定下一个内核的时间已经开始。

- 稳定窗口(大约6-10周): 
   只有解决问题的补丁才应该提交到主线。有时会允许进行更重大的更改，但这种情况很少见；尝试在合并窗口之外合并新功能的开发人员往往会受到不友好的对待。一般来说，如果您错过了给定功能的合并窗口，最好的办法就是等待下一个开发周期。（以前不支持的硬件的驱动程序偶尔会有例外；如果它们不接触内核代码，则它们不会导致回归，并且应该可以随时安全地添加）。

### RC版本

随着修复进入主线，补丁速度会随着时间的推移而减慢。Linus 大约每周发布一次新的 -rc 内核；在内核被认为足够稳定并发布最终版本之前，正常系列将达到 -rc6 和 -rc9 之间的某个值。随后新一轮的版本又开始
下表示内核在两个稳定版本之间发布的窗口版本

| 发布版本    | 发布时间  |
| ------- | ----- |
| 5.3     | 9.15  |
| 5.4-rc1 | 9.30  |
| 5.4-rc2 | 10.6  |
| 5.4-rc3 | 10.13 |
| 5.4-rc4 | 10.20 |
| 5.4-rc5 | 10.27 |
| 5.4-rc6 | 11.3  |
| 5.4-rc7 | 11.10 |
| 5.4-rc8 | 11.17 |
| 5.4稳定   | 9.24  |

**注意**

   很久以前，Linux 使用的系统中第一个点后的奇数表示预发布、开发内核（例如 2.1、2.3、2.5）。这个方案在内核 2.6 发布后被放弃，
   现在预发布的内核用“-rc”表示。。

### 稳定版本维护

内核就算发布完成稳定版本之后，也会对稳定版本进行定期维护，如果patch 满足以下条件，将会考虑合入稳定版本

- 修复了某个重大错误
- 在满足上一个条件下，同时patch 已经合入了内核主线 (just cherry-pick)

下表示内核在稳定版本之后 稳定维护版本

| 发布版本   | 发布时间  |
| ------ | ----- |
| 5.2稳定  | 7.7   |
| 5.2.1  | 7.14  |
| 5.2.2  | 7.21  |
| ...    | ...   |
| 5.2.21 | 10.11 |

5.2.21 是 5.2 版本的最终稳定更新。

### 长期版本

内核也会偶尔有一些长期版本维护 但是不会很多，完全取决于社区负责人的时间和精力，只有非常重要的错误会合入， [长期版本](https://www.kernel.org/category/releases.html )

**注意**

   如果你使用的是发行版操作系统，可能他使用的内核版本并不在社区长期版本列表，但是发行商一般也有自己对应版本的长期维护时间，可以通过 *uname -r* 查看你是用的内核版本

## 补丁合入机制

通过本节，应该要掌握

- 补丁信任链机制
- next tree

### 信任链

只有一个人可以将补丁合并到主线内核中：Linus Torvalds，但是，
例如，在进入 2.6.38 内核的 9,500 多个补丁中，只有 112 个（约 1.3%）是 Linus 本人直接选择的。
内核项目早已发展到没有任何一个开发人员能够在无人帮助的情况下检查和选择每个补丁。
内核开发人员解决这种增长问题的方法是使用围绕信任链构建系统。

**子系统&子系统maintainer**

内核代码库在逻辑上分为一组子系统：
网络、特定体系结构支持、内存管理、视频设备等。大多数子系统都有指定的维护者，即对该子系统内的代码全面负责的开发人员。这些子系统维护者是他们管理的内核部分的看门人（以松散的方式）；他们（通常）会接受补丁并纳入主线内核。

**子系统maintainer的仓库** 

子系统维护者以他们自己的方式维护着一个或者几个分支，他们会收集下游补丁，然后合入自己分支，然后在提给linux，或者他的上游

**补丁合入主线** 

之前我们介绍过了合入窗口，一般当合入窗口开启，最顶层的维护者会要求linux拉取他们仓库中选择用于合并的补丁，
通常linux只会关注某些，并无法做到全部检查，但是他选择相信这些顶级维护者

**链式合入** 

顶级维护者又会从他的下游收集补丁，以此类推，按照各个层级，依次往上收集补丁，这就是信任链

所以，我们如果有补丁要合入，直接发给linux 很明显是不明智的，应该根据自己所处的链条节点，向上发送

### next tree

OK，我们已经指导补丁是通过层层挑选 然后最终进入主线的

- 我应该基于哪个分支开发？
- 我的代码会不会和别人冲突？

为了解决上面两个问题，现在主要通过next tree分支，该分支可以理解是下一个内核版本的快照,
所有即将或者准备合入主线的补丁，都会先进入这个[分支](https://www.kernel.org/pub/linux/kernel/next/)

如果是一个新手，刚进入社区，往往不知道如何下手，我给一个建议，请永远使用最新的next分支，并尝试把他在你的环境上运行起来，
由于这个分支特性和代码往往都是新的，可能会有一些问题，尝试去解决这些问题

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