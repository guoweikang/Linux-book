
# Linux各类环境安装指导

## 内核运行环境

自己可以准备一个开发板或者是虚拟机这种实际可以把内核跑起来的环境，我们的实验环节，
可能会涉及到对代码的修改验证
	
- ARM64:我使用的是一个树莓派4B的开发板+ openeuler的操作系统 用于测试ARM
- X86: 我使用的是openeuler的VMware虚拟机环境 用于追踪社区代码
- QEMU：我是用的是最新的linux next代码 用于追踪主线最新的代码

当然，如果你有自己的环境，可以不参考我以下环境准备步骤

###  树莓派编译环境准备

我的环境参考openeuler社区版本 22.03 SP1  基于内核版本 5.10

 - 操作系统安装: https://docs.openeuler.org/zh/docs/22.03_LTS_SP1/docs/Installation/%E5%AE%89%E8%A3%85%E5%87%86%E5%A4%87-1.html
 - 树莓派使用指南: https://gitee.com/openeuler/raspberrypi/blob/master/documents/%E6%A0%91%E8%8E%93%E6%B4%BE%E4%BD%BF%E7%94%A8.md
 - 内核交叉编译指南： https://gitee.com/openeuler/raspberrypi/blob/master/documents/%E4%BA%A4%E5%8F%89%E7%BC%96%E8%AF%91%E5%86%85%E6%A0%B8.md

### 发行版开发环境准备

使用虚拟机的好处在于：不需要考虑交叉编译，内核可以直接安装在虚拟机，开发环境可以直接作为测试验证环境

- 操作系统安装: https://ken.io/note/openeuler-virtualmachine-install-by-vmware 

提供了多种内核源码的下载方法：
	
- 通过rpm下载安装: 好处是内核版本和本机发行版一致，可以直接编译安装，缺点是没有git 信息，参考：https://forum.openeuler.org/t/topic/615
- 通过开发社区开发: https://ost.51cto.com/posts/15844 
- 本地基于make安装: https://openanolis.cn/sig/Cloud-Kernel/doc/607587039726485317?preview=


## 社区邮件
 

### 邮件列表

大量的 Linux 内核开发工作是通过邮件列表完成的。如果不加入至少一个列表，就很难成为社区的一名功能齐全的成员。
但 Linux 邮件列表也对开发人员构成了潜在危险，他们面临着被大量电子邮件淹没、违反 Linux 列表上使用的约定或两者兼而有之的风险。

!!! note

    大多数内核邮件列表都在 vger.kernel.org 上运行；主列表可在以下位置找到： http://vger.kernel.org/vger-lists.html
	不过，其他地方也有一些列表；其中一些位于 redhat.com/mailman/listinfo

### 邮件客户端配置

参考来自: 
 - https://docs.kernel.org/translations/zh_CN/process/email-clients.html
 - https://kofno.wordpress.com/2009/08/09/how-fetchmail-and-mutt-saved-me-from-email-mediocrity/

我们使用 MUTT作为邮件客户端需要搭配其他软件一起使用

 - 收件: 使用 fetchmail
 - 发件: 使用 msmtp
 - 分类: 使用 maildrop
 - 邮件编辑: vim

安装工具

```
	$ sudo dnf install -y mutt fetchmail  libgsasl maildrop -y
	$ 欧拉没有提供msmtp 包需要手动下载 安装
	$ sudo rpm -ivh ./msmtp-1.8.10-1.el8.x86_64.rpm 
```


### 配置发件箱

```
	
	$ cd ~
	$ mkdir mail -- 稍后发件箱归档需要
	$ touch ~/.msmtprc
	$ touch ~/log/msmtp/msmtp.log
	$ vim ~/.msmtprc
	$ sudo chmod 600 .msmtprc --设置配置文件权限
	$ msmtp -S --debug msmtp测试
```

~/.msmtprc 参考配置: 

```
	defaults
	logfile ~/log/msmtp/msmtp.log
	account default
	auth on
	tls on
	tls_starttls off
	host smtp.qq.com
	port 465
	from xxxx@qq.com
	user xxxxx@xxxx.com
	password xxxxxx
```

### 配置收件箱
Fetchmail是一个非常简单的收件程序，而且是前台运行、一次性运行的，意思是：你每次手动执行fetchmail命令，都是在前台一次收取完，程序就自动退出了，不是像一般邮件客户端一直在后台运行。

!!! note

    fetchmail只负责收件，而不负责存储！所以它是要调用另一个程序如procmail来进行存储的。
    fetchmail的配置文件为~/.fetchmailrc。然后文件权限最少要设置chmod 600 ~/.fetchmailrc


配置fetchmailrc收件:

```
	
	$ vim ~/.fetchmailrc
	$ chmod 600 ~/.fetchmailrc
	$ fetchmail  -v  --- 测试收取命令
```


参考配置: 
```
	
	poll imap.xxxx.com
        with proto IMAP
        user "user@zoho.com"
        there with password "pass"
        is "localuser" here
        mda "/usr/bin/maildrop " 
        options
        ssl
```

fetchmail只负责收取，不负责“下载”部分，你找不到邮件存在哪了。, 需要配置MDA分类器，如maildrop，才能看到下载后的邮件。

!!! note

	Fetch其实不是在Mutt`里面`使用的，而是脱离mutt之外的！也就是说，Mutt只负责读取本地存储邮件的文件夹更新，而不会自动帮你去执行fetchmail命令。

设置Mutt快捷键收取邮件的方法是在~/.muttrc中加入macro：

```
	macro index,pager I '<shell-escape> fetchmail -vk<enter>'
```
	
这样的话，可以在index邮件列表中按I执行外部shell命令收取邮件了。


### 配置收件存储分类

maildrop是单纯负责邮件的存储、过滤和分类的，一般配合fetchmail收件使用。

在Pipline中，fetchmail把收到的邮件全部传送到maildrop进行过滤筛选处理，然后maildrop就会把邮件存到本地形成文件，然后给邮件分类为工作、生活、重要、垃圾等。

maildrop 的配置文件是 ~/.mailfilter ，记得改权限：chmod 600 ~/.mailfilter。


配置procmailrc收件:

```
	
	$ vim ~/.mailfilter
	$ chmod 600 ~/.mailfilter
```

参考配置: 

```
	DEFAULT="/home/xxx/Mail/Inbox/"
	logfile "/home/xxx/.maillog"
	IMPORTANT "/home/xxx/Mail/Inbox/.IMPORTANT"
	SELF "/home/xxx/Mail/Inbox/.SELF"

	#Move emails from a specific sender to the "Important" folder
	if (/^From:.*important_sender@example\.com/)
	{
	    to $IMPORTANT
	}
	
	if (/^From: slef@xxx\.com/)
	{
	    to $IMPORTANT
	}	
	
	# Discard emails from a specific domain
	#if (/^From:.*@spamdomain\.com/)
	#{
	#    exception
	#}
```

```
	
	$ mkdir  ~/Mail
	$ maildirmake ~/Mail/Inbox
	$ maildirmake ~/Mail/Inbox/.IMPORTANT
	$ maildirmake ~/Mail/Inbox/.SELF
```

### 配置MUTT主界面

```
	$ vim ~/.muttrc 
	$ chmod 600 ~/.muttrc
```
muttrc 参考配置: 

```
	
	# .muttrc
	auto_view text/html
	# ================  IMAP ====================
	set mbox_type=Maildir
	set folder = "$HOME/Mail/Inbox"
	mailboxes "/home/guoweikang/Mail/Inbox/.IMPORTANT"  "~/Mail/Inbox/.SELF"
	#set mask="^!\\.[^.]"  # 屏蔽掉.开头的邮箱
	set spoolfile = "$HOME/Mail/Inbox" #INBOX
	set mbox="$HOME/Mail/Inbox"   #Seen box
	set record="+Sent"  #Sent box
	set postponed="+Drafts"  #Draft box
	set sort=threads
	
	# ================  SEND  ====================
	set sendmail="/usr/bin/msmtp"           # 用 msmtp 发邮件
	set realname = "xxxx"
	set from = "xxxxxxxxx@xxxxxxxxx.com"
	set use_from = yes
	
	# ================  Composition  ====================
	set realname = "xxxxxxxxx"
	set use_from = yes
	set editor = vim
	set edit_headers = yes  # See the headers when editing
	set charset = UTF-8     # value of $LANG; also fallback for send_charset
	# Sender, email address, and sign-off line must match
	unset use_domain        # because joe@localhost is just embarrassing
	set envelope_from=yes
	set move=yes    #移动已读邮件
	set include #回复的时候调用原文
	macro index,pager I '<shell-escape> fetchmail -vk<enter>'

```

### 测试基本功能


#### 发送邮件

```
	$   echo "hello world" | mutt -s "test" -- xxxx@xxxxx -- 测试发送邮件 
```

#### 接收邮件

```
	$ mutt 
```

进入界面后 输入 "I" 触发fetchmail 

!()[./images/env/2.png]

输入 "c" 切换邮箱

!()[./images/env/c.png]



### 测试一个补丁
本小节，通过制作补丁 发送补丁 回复补丁 这三个步骤演示

#### 制作补丁


在next分支修改代码，并本地提交,属于基本的GIT操作，不在这里介绍了。格式如下

```
$ git commit -s
```

内容格式如下:

!()[./images/env/4.png]


制作检查本地补丁:

```
	$ git  format-patch  --subject-prefix='PATCH'   -1 
	$ 本地目录生成  0001-debugobjects-add-pr_warn.patch
	$ ./scripts/checkpatch.pl  0001-debugobjects-add-pr_warn.patch  --检查补丁
```

#### 发送补丁

获取补丁接收人

```
	$./scripts/get_maintainer.pl  0001-debugobjects-add-pr_warn.patch  --获取邮件接收人
```

!()[./images/env/5.png]

 
前面的是需要主送的，open是需要抄送的，

因为是测试，我们只发送给自己:

```
	$ git  send-email --to  xxxx@xxxx.com --cc xxxx@xxx.com  0001-debugobjects-add-pr_warn.patch 
```

#### 回复补丁

mutt 应该可以收到邮件，我们假设我们是 maintainer， 对邮件进行回复，提出意见

!()[./images/env/6.png]

#### 参考
[最佳实践参考](https://www.xcodesucks.top/articles/%E4%B8%BA%20Linux%20%E5%86%85%E6%A0%B8%E6%8F%90%E4%BA%A4%20Patch%EF%BC%9A%E6%9C%80%E7%AE%80%E5%AE%9E%E8%B7%B5.html)

[官方指导](https://www.kernel.org/doc/html/v4.17/process/submitting-patches.html)

## 内核开发

### 常用构建命令和含义

- make mrproper : 清理配置文件、过程中间件等一切中间产物，只保留干净的源码
- make clean/distclean ： 一般项目构建不在使用了 使用mrproper 重新构建
- make dtbs：构建平台DTS
- make xxx_defconfig : 生成.config 
- make menuconfig : 配置defconfig 
- make defconfg: 最小化defconfig 可以用来保存为平台defconfig


### 关于补丁验证


本地编译检查：

 - 使用适用或修改的 CONFIG 选项 =y、=m 和 =n 。没有GCC 警告/错误，没有链接器警告/错误。
 - 通过allnoconfig、allmodconfig编译成功
 - 使用 O=builddir 时可以成功编译
 - 本地交叉编译 可以在多个CPU体系构建(PPC64是一种很好的交叉编译检查体系结构，因为它倾向于对64位的数使用无符号 长整型)
 -  make headers_check 检查头文件包含的正确 如果涉及
 - 通过了  make EXTRA-CFLAGS=-W 开启告警编译
 

代码风格检查：

 - 参考 coding-style.rst
 - ./scripts/checkpatch.pl  脚本检查

Kconfig 

 - 所有新的 kconfig 选项都有帮助文本
 - 已仔细审查了相关的 Kconfig 组合。这很难用测试来纠正——脑力在这里是有 回报的。

bug检查 

 - 通过 make C=1 : 使用sparse  检查 
 - 通过make checkstack 检查可能的堆栈溢出
 - 通过make namespacecheck  检查可能出现的明明空间冲突
 - 通过注入slab和page分配失败检查 参考Documentation/fault-injection/ 

关于文档： 如果提供了API 文档描述，还需要测试

 - make htmldocs 或 make pdfdocs 检查 kernel-doc 
 - 所有新的/proc条目都需要记录在 Documentation/
 - 所有新的内核引导参数都记录在 Documentation/admin-guide/kernel-parameters.rst 中。
 - 所有内存屏障例如 barrier(), rmb(), wmb() 都需要源代码中的注 释来解释它们正在执行的操作及其原因的逻辑。
 - 如果补丁添加了任何ioctl，那么也要更新 Documentation/ioctl/ioctl-number.rst

运行时验证:

 - CONFIG_PREEMPT, CONFIG_DEBUG_PREEMPT, CONFIG_DEBUG_SLAB, CONFIG_DEBUG_PAGEALLOC, CONFIG_DEBUG_MUTEXES, CONFIG_DEBUG_SPINLOCK, CONFIG_DEBUG_ATOMIC_SLEEP, CONFIG_PROVE_RCU and CONFIG_DEBUG_OBJECTS_RCU_HEAD 同时打开
 - 开启和关闭 CONFIG_SMP, CONFIG_PREEMPT的运行时测试
 - 保证在 所有代码路径都已在启用所有lockdep功能的情况下运行 
 

### 关于琐碎的补丁
 
一开始 我们可能都是从文档修正、告警修正、编译修正这些很小的点开始进入内核 这些补丁应该被 trivial@kernel.org 专门收集 包括: 

 -文档的拼写修正。
 -修正会影响到 grep(1) 的拼写。
 -警告信息修正(频繁的打印无用的警告是不好的。)
 -编译错误修正（代码逻辑的确是对的，只是编译有问题。）
 -运行时修正（只要真的修正了错误。）
 -移除使用了被废弃的函数/宏的代码例如 check_region
 -联系方式和文档修正。
 -用可移植的代码替换不可移植的代码（即使在体系结构相关的代码中，既然有人拷贝，只要它是琐碎的
 -任何文件的作者/维护者对该文件的改动（例如 patch monkey 在重传模式下）


关于“琐碎补丁”的一些说明：”trivial”这个英文单词的本意是“琐碎的，不重要的。”但是在这里 有稍微有一些变化，
例如对一些明显的NULL指针的修正，属于运行时修正，会被归类 到琐碎补丁里。
虽然NULL指针的修正很重要，但是这样的修正往往很小而且很容易得到 检验，
所以也被归入琐碎补丁。琐碎补丁更精确的归类应该是 “simple, localized & easy to verify”，
也就是说简单的，局部的和易于检验的。 trivial@kernel.org邮件列表的目的是针对这样的补丁，
为提交者提供一个可能，来降低提交的门槛。)


关于补丁格式

 - 不要一次返送超过15个补丁
 - 要有主题，比如 PATCH 需要加上 [PATCH] 前缀
 - 必须要要有签名: Signed-off-by:
 - Acked-by： 表明谁参与过该补丁讨论
 - Co-developed-by: 补丁共同开发着
 - Reported-by: bug 发现人
 - Tested-by：补丁测试人
 - Reviewed-by： 补丁review 者