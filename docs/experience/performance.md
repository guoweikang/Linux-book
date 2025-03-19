## Performance

```json
"node" {
    "label": "performance",
    "categories": ["mem"],
    "info": "performance  skill",
    "depends": [
      ]
}
```

### 小算法

#### 区间重叠判断

判断两个区间是否有重合 `start1` `end1`  `start2` `end2`

常规逻辑 可能会习惯于根据不同的重叠情况进行判断 比如 

```c
/*        start1 --------------- -------------end1 
   start2 -------- end2   
                    start2 ---- end2 
                                    start2 ---------- end2
*/

if (star2 < start1 && end2 < end1) 
    || (start2 > start1 && end2 < end1)
    || (start2 < end1 && end1 < end2)
```

上述方法都是在`start` 和 `end`之间做对比 换个思路 我们取不重叠的情况 

```c
 /*  s1 ------ e1  s2 ------------e2
  *  s2 -------e2  s2 ----------- e2 
  */
 // not overlap
 if (e1 < s2 ||  e2 < s2)
 // reverse
 if !(e1 < s2 || e2 < s1)
 // more efficent way use cpu pipline preload
 if (s2 < e1 && s1 < e2)
```

`memblock`   是一个典型的使用场景

```c
  unsigned long 
  memblock_addrs_overlap(phys_addr_t base1, phys_addr_t size1, phys_addr_t base2,
                         phys_addr_t size2)                                  
  {                                                                          
          return ((base1 < (base2 + size2)) && (base2 < (base1 + size1)));   
  }      
```
