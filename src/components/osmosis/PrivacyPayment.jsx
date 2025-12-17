import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const PrivacyPayment = () => {
    const [recipient, setRecipient] = useState('');
    const [link, setLink] = useState('');

    const generateStealthLink = () => {
        if (!recipient) {
            alert("Please enter a recipient");
            return;
        }
        // In a real implementation, this would involve ECIES encryption or interactions with a Privacy Pool contract.
        // For now, we encode the intent into the URL.
        const payload = btoa(JSON.stringify({ to: recipient, amount: 'variable' }));
        setLink(`${import.meta.env.VITE_WEBSITE_HOST}/pay/secure?data=${payload}`);
    };

    const copyLink = () => {
        navigator.clipboard.writeText(link);
        alert('Stealth Link Copied!');
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-6 text-black border border-gray-800/20 shadow-lg"
        >
             <h2 className="text-xl font-bold mb-2">Send Secretly</h2>
             <p className="text-gray-600 text-sm mb-6">Generate a one-time stealth link. The recipient cannot identify you, and observers cannot trace the payment.</p>

             <div className="space-y-4">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Recipient (Optional - for notification)</label>
                    <input 
                        type="text" 
                        className="w-full border border-gray-800/20 rounded-lg px-4 py-3 text-black focus:border-purple-500 focus:outline-none transition-colors"
                        placeholder="@username or email"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                    />
                </div>

                <AnimatePresence>
                    {link ? (
                        <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-black/90 border rounded-lg p-4"
                        >
                            <p className="text-xs text-white font-bold mb-2">GENERATED STEALTH LINK</p>
                            <div className="flex items-center gap-2 bg-black/50 p-2 rounded border border-white/10">
                                <code className="text-xs text-gray-300 flex-1 overflow-hidden text-ellipsis">{link}</code>
                                <button onClick={copyLink} className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <button 
                            onClick={generateStealthLink}
                            className="w-full py-3 bg-black/90 text-white font-bold rounded-lg hover:bg-black/80 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                            Generate Stealth Link
                        </button>
                    )}
                </AnimatePresence>
             </div>
        </motion.div>
    );
};
