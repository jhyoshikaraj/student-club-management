const Notification = require('../models/Notification');
exports.listNotifications = async (req, res) => res.json(await Notification.find({ recipient: req.user._id }).sort('-createdAt').limit(200));
exports.markRead = async (req, res) => {
 const n = await Notification.findOneAndUpdate({ _id:req.params.id, recipient:req.user._id }, { read:true }, { new:true });
 if (!n) return res.status(404).json({message:'Notification not found'}); res.json(n);
};
exports.markAllRead = async (req,res) => { await Notification.updateMany({recipient:req.user._id,read:false},{read:true}); res.json({message:'All notifications marked read'}); };
exports.deleteNotification = async (req,res) => { const n=await Notification.findOneAndDelete({_id:req.params.id,recipient:req.user._id}); if(!n)return res.status(404).json({message:'Notification not found'}); res.json({message:'Notification deleted'}); };
exports.deleteAll = async (req,res) => { await Notification.deleteMany({recipient:req.user._id}); res.json({message:'All notifications deleted'}); };

exports.deleteRead = async (req,res) => { const result=await Notification.deleteMany({recipient:req.user._id,read:true}); res.json({message:'Read notifications deleted',deleted:result.deletedCount}); };
