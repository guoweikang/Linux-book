$(function(){
	let visgraph = null;
	//可视化默认配置
	const config = {
		node:{ //节点的默认配置
			label:{ //标签配置
				show:true, //是否显示
				color:'250,250,250',//字体颜色
				font:'normal 30px KaiTi',//字体大小及类型 LiSu Arial
				textPosition:'Bottom_Center',//文字位置 Top_Center,Bottom_Center,Middle_Right,Middle_Center
				//borderWidth:1,
				//borderColor:'100,250,150',
				//textOffsetY:4,
				//backgroud:'250,250,250'
			},
			shape:'circle',//自定义节点时默认都是在rect包裹内部绘制
			size:100,
			color:'30,160,255',
			borderColor: '200,200,200', //边框颜色
			borderWidth: 0, //边框宽度,
			borderRadius: 0, //边框圆角大小
			lineDash: [0], //边框虚线间隔,borderWidth>0时生效
			alpha: 1, //节点透明度
			selected: { //选中时的样式设置
				borderColor: '238,238,0', //选中时边框颜色
				borderAlpha: 1, //选中时的边框透明度
				borderWidth: 3, //选中是的边框宽度
				showShadow: true, //是否展示阴影
				shadowColor: '238,238,0' //选中是的阴影颜色
			},
			onClick:function(event,node){
				findNode(node);
			}
		},
		link: { //连线的默认配置
			label: { //连线标签
				show: false, //是否显示
				color: '100,100,200', //字体颜色
				font: 'normal 8px Arial', //字体大小及类型
				//borderColor:'100,200,125',
				backgroud:'200,200,200'
			},
			lineType: 'direct', //连线类型,curver,vlink,hlink,vbezier,hbezier
			colorType: 'defined', //连线颜色类型 source:继承source颜色,target:继承target颜色 both:用双边颜色，d:自定义
			color: '200,200,200', //连线颜色
			alpha: 1, // 连线透明度
			lineWidth: 8, //连线宽度
			lineDash: [0], //虚线间隔样式如：[5,8]
			showArrow: false, //显示连线箭头
			selected: { //选中时的样式设置
				color: '20,250,50', //选中时的颜色
				alpha: 1,
				lineWidth: 4,
				showShadow: false, //是否展示阴影
				shadowColor: '50,250,50', //选中连线时的阴影颜色
			}
		},
		highLightNeiber:true,
		wheelZoom:0.8
	};
	
	//1、初始化图对象
	visgraph = new VisGraph(document.getElementById('graph-panel'),config);
	//visgraph.switchAnimate(true);//开启动画模式
	visgraph.setShowDetailScale(0.1);//显示详细
	
	//数据

	var demoData =  {
		"nodes":[
			{
				"id":1,
				"label":"前置知识点",
				"x":-1049,
				"y":2447,
				"size":39,
				"scale":"1.8",
				"color":"rgb(120,233,133)"
			},
			{
				"id":2,
				"label":"版本介绍",
				"x":-655,
				"y":2163,
				"size":39,
				"scale":"3.8",
				"color":"rgb(120,233,133)"
			},
		],
		"links":[
			{
				"source":1,
				"target":2
			},
			{
				"source":21,
				"target":20
			}
		]
	};
		

	visgraph.drawData(demoData);
	visgraph.setZoom('auto');
	
	
	
	//下拉联想选择
	var labelDatas = demoData.nodes.map((node)=>{
		return {value:node.label,id:node.id};
	});
	initAutoSelect(labelDatas);
	
	visgraph.nodes.forEach((node)=>{
		//node.wrapText = true;
		if(node.id == 10){
			node.width = node.height = 300;
			node.font='bold 60px KaiTi';
			node.wrapText = true;
			node.drawNode=drawSpacialNode;
			
		}else if(node.id < 1000){
			node.width = node.height =200;
			node.font='bold 40px KaiTi';
			//node.fontColor='30,30,30';
			node.wrapText = true;
			node.drawNode=drawSpacialNode;
		}else if(node.id>1000 && node.id<10000){
			//node.setImage('img/icon/home.png');
			node.width = node.height =120;
		}else{
			//node.setImage('img/icon/table.png');
			node.width = node.height = 80;
		}	
	});
	
	visgraph.links.forEach((link)=>{
		link.lineWidth = 16;
		link.lineType='arrowline';
		link.colorType='both';
		//link.colorType='defined';
		//link.strokeColor='100,200,100';
		
		if(link.source.id == 10){
			link.lineWidth=40;
		}
	});
	
	visgraph.refresh();
	
	//查找节点
	function findNode(node){
		visgraph.scene.addToSelected(node);
		visgraph.focusTargetEle(node);
		//visgraph.moveNodeToCenter(node,800);
	}
	
	$('#searchEventBtn').click(function(){
		var nodeName = $.trim($('#nodename').val());
		var node = visgraph.findNodeByAttr('label',nodeName);
		if(node){
			findNode(node);
		}
	});
	
	function initAutoSelect(data){
		$('#nodename').autocomplete({
			lookup: data,
			minChars: 1,
			onSelect: function (item) {
				var node = visgraph.findNodeByAttr('id',item.id);
				if(node){
					findNode(node);
				}
			},
			showNoSuggestionNotice: true,
			noSuggestionNotice: '暂无结果',
		});
	}
	
	//画特殊节点
	function drawSpacialNode(ctx){
		var radius = this.radius;
		this.animate = this.animate>100?20:this.animate;
		ctx.save();
		ctx.beginPath();
		if (this.selected) {
			ctx.shadowBlur = this.radius,
			ctx.shadowColor = "rgba(20,250,20," +this.alpha+")",
			ctx.shadowOffsetX = 0,
			ctx.shadowOffsetY = 0;
		}
		ctx.arc(0, 0, radius, 0, 2*Math.PI);
		ctx.fillStyle='rgba('+this.fillColor+','+this.alpha+')';
		ctx.fill();
		ctx.closePath();
		ctx.restore();
		
		ctx.save();
		ctx.beginPath();
		ctx.arc(0,0,radius+20,0,2*Math.PI);
		ctx.lineWidth = 10;
		//ctx.strokeStyle = 'rgba(20,250,20)';
		ctx.strokeStyle = 'rgba('+this.fillColor+','+this.alpha+')';
		ctx.setLineDash([10,6]);
		ctx.lineDashOffset=(this.animate+=5);
		ctx.stroke();
		ctx.closePath();
		ctx.restore();
		
		ctx.save();
		ctx.beginPath();
		ctx.arc(0,0,radius-8,0,2*Math.PI);
		ctx.lineWidth = 8;
		ctx.strokeStyle = 'rgba(20,250,20,'+this.alpha+')';
		ctx.setLineDash([4,6]);
		ctx.lineDashOffset=(this.animate++);
		ctx.stroke();
		ctx.closePath();
		ctx.restore();
		
		this.showlabel==true?this.paintText(ctx):'';
	};
	
	
	
});