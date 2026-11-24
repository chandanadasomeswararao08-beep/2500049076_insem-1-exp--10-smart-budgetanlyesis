const router=require("express").Router(),auth=require("../middleware/auth"),Goal=require("../models/SavingsGoal");
router.use(auth);
router.get("/",async(req,res)=>res.json(await Goal.find({user:req.user.id}).sort({createdAt:-1})));
router.post("/",async(req,res)=>{const targetPaise=Math.round(Number(req.body.target)*100);if(!req.body.title||!Number.isSafeInteger(targetPaise)||targetPaise<1)return res.status(400).json({message:"Enter a goal name and valid target."});const g=await Goal.create({user:req.user.id,title:req.body.title,targetPaise,targetDate:req.body.targetDate||undefined});res.status(201).json(g);});
router.post("/:id/contribute",async(req,res)=>{const add=Math.round(Number(req.body.amount)*100);if(!Number.isSafeInteger(add)||add<1)return res.status(400).json({message:"Enter a positive contribution."});const g=await Goal.findOneAndUpdate({_id:req.params.id,user:req.user.id},{$inc:{savedPaise:add}},{new:true});if(!g)return res.status(404).json({message:"Goal not found."});res.json(g);});
router.delete("/:id",async(req,res)=>{await Goal.findOneAndDelete({_id:req.params.id,user:req.user.id});res.json({message:"Goal deleted."});});
module.exports=router;
