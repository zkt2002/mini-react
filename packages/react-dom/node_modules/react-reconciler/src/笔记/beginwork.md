对于如下结构的reactElement:
<A>
  <B>
</A>
当进入A的beginWork时，通过对比B的current fiberNode与B reactElement,
生成B对应wip fiberNode
在此过程中最多会标记2类与 [结构变化] 相关的flags
-placement
插入：a -> ab 移动: abc -> bca
-ChildDeletion
删除 ul>li*3 => ul>li*1
不包含与 属性变化 相关的flag
Update
<img title='鸡'> => <img title='你太美'>