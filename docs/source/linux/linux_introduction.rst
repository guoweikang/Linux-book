
==========
Linux介绍
==========

前一章节粗略介绍了操作系统的功能，解决了哪些痛点,Linux作为操作系统的一个实现，并且是开源社区最活跃项目之一，确实可以作为我们的一个学习对象

本章作为Linux的一个前置介绍，为了保证后续章节的连续性，主要包含: 

 - Linux环境准备


Linux环境准备
==============

.. note::

   涉及到的命令，主机操作系统默认使用 ubuntu 系列，其他系列操作系统请自行搜索对应的命令

Linux 硬件准备
---------------
.. note::

	建议，自己可以准备一个开发板或者是qemu这种实际可以把内核跑起来的环境，我们的实验环节，可能会涉及到对代码的修改验证
	我自己使用的是一个树莓派4B的开发板+ openeuler的操作系统，如果你有其他开发环境，可以不参考我对于这部分的步骤

Linux 编译环境准备
-------------------
我的环境参考openeuler社区版本 22.03 SP1  基于内核版本 5.10

 - 操作系统安装: https://docs.openeuler.org/zh/docs/22.03_LTS_SP1/docs/Installation/%E5%AE%89%E8%A3%85%E5%87%86%E5%A4%87-1.html
 - 树莓派使用指南: https://gitee.com/openeuler/raspberrypi/blob/master/documents/%E6%A0%91%E8%8E%93%E6%B4%BE%E4%BD%BF%E7%94%A8.md
 - 内核交叉编译指南： https://gitee.com/openeuler/raspberrypi/blob/master/documents/%E4%BA%A4%E5%8F%89%E7%BC%96%E8%AF%91%E5%86%85%E6%A0%B8.md

Linux 开发环境准备
-------------------
专门准备一节介绍linux的代码阅读准备，是因为: 

 - Linux 不同于普通的C项目，他的代码非常庞大，我们需要只引用我们关心的代码
 - Linux 主干代码支持多个架构，我们只需要关心一个特定架构
 - Linux 有自己编码风格 我们需要使用内核编码风格
 - Linux 不使用标准C库，有自己的库，我们不应该索引libc 的头文件
 - .....
 
 本小节会指导完成阅读Linux需要的工具安装，以及索引的使用，无论如何，我假设你已经熟悉这些工具的使用，或者请自己搜索一下这些工具的使用方法 


安装代码索引工具
^^^^^^^^^^^^^^^^

推荐使用 *cscope* 和 *ctags*，安装命令: 

.. code-block:: console
    :linenos:

    $ sudo apt install cscope exuberant-ctags

:扩展:
   
   - *cscope*：主要用于导航代码，例如在函数之间完成切换，能够找到符号的定义以及所有调用
   - *ctags*：Tagbar 插件需要，也可以用来导航，但是没有cscope 好用，只能跳转到函数定义，不能找到所有调用点
   
 
创建代码索引数据库
^^^^^^^^^^^^^^^^^^^^
有两种方法对内核代码创建索引：
 
 - 手动创建索引
 - 使用内核脚本
