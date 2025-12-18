import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardBody, Input, Button } from '@nextui-org/react';
import { Shield, Copy, Check, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export const PrivacyPayment = () => {
    const [recipient, setRecipient] = useState('');
    const [link, setLink] = useState('');

    const generateStealthLink = () => {
        // Simulate stealth link generation
        const randomId = Math.random().toString(36).substring(7);
        setLink(`${import.meta.env.VITE_WEBSITE_HOST}/pay/${randomId}?stealth=true`);
    };

    const [copied, setCopied] = useState(false);

    const copyLink = () => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        toast.success('Stealth link copied!');
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl">
            <CardBody className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Send Secretly
                </h3>
                <p className="text-gray-600 text-sm mb-6">
                    Generate a one-time stealth link. The recipient cannot identify you, and observers cannot trace the payment.
                </p>

             <div className="space-y-4">
                    <Input
                        label="Recipient (Optional)"
                        placeholder="@username or email"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        variant="bordered"
                        classNames={{
                            inputWrapper: "h-12 focus-within:border-blue-400",
                            label: "text-gray-700 font-semibold"
                        }}
                        description="Optional: for notification purposes only"
                    />

                <AnimatePresence>
                    {link ? (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            >
                                <Card className="bg-gradient-to-br from-blue-600 to-indigo-600 border border-blue-500 shadow-lg">
                                    <CardBody className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Zap className="w-4 h-4 text-white" />
                                            <p className="text-xs text-white font-bold uppercase">Generated Stealth Link</p>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm p-3 rounded-lg border border-white/30">
                                            <code className="text-xs text-white flex-1 truncate font-mono">{link}</code>
                                            <Button
                                                isIconOnly
                                                variant="light"
                                                onClick={copyLink}
                                                className="text-white hover:bg-white/30 min-w-8"
                                                size="sm"
                                            >
                                                {copied ? <Check className="w-4 h-4 text-green-200" /> : <Copy className="w-4 h-4" />}
                                            </Button>
                            </div>
                                        <p className="text-xs text-white/90 mt-3">
                                            Share this link securely. Each payment uses a unique stealth address.
                                        </p>
                                    </CardBody>
                                </Card>
                        </motion.div>
                    ) : (
                            <Button
                            onClick={generateStealthLink}
                                className="w-full h-12 font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:from-blue-500 hover:to-indigo-500 transition-all"
                                startContent={<Zap className="w-5 h-5" />}
                        >
                            Generate Stealth Link
                            </Button>
                    )}
                </AnimatePresence>
             </div>
            </CardBody>
        </Card>
    );
};
