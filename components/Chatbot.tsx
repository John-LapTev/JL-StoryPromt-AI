
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";

interface ChatbotProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Message {
    sender: 'user' | 'bot';
    text: string;
}

export const Chatbot: React.FC<ChatbotProps> = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [chat, setChat] = useState<Chat | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && !chat) {
            if (!process.env.API_KEY) {
                console.error("API_KEY not set for chatbot");
                setMessages([{ sender: 'bot', text: 'Ошибка: API ключ не настроен.' }]);
                return;
            }
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const chatSession = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: 'Ты — полезный и креативный ассистент для создателя видео-раскадровок. Предлагай идеи, давай советы и отвечай на вопросы кратко и по делу.',
                },
            });
            setChat(chatSession);
             setMessages([{ sender: 'bot', text: 'Чем могу помочь с вашей раскадровкой?' }]);
        }
    }, [isOpen, chat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !chat || isLoading) return;

        const userMessage: Message = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const responseStream = await chat.sendMessageStream({ message: input });
            let botResponse = '';
            setMessages(prev => [...prev, { sender: 'bot', text: '...' }]); 

            for await (const chunk of responseStream) {
                botResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { sender: 'bot', text: botResponse };
                    return newMessages;
                });
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { sender: 'bot', text: 'Извините, произошла ошибка.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={`fixed top-0 right-0 h-full bg-[#191C2D] border-l border-white/10 shadow-2xl z-40 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} w-full max-w-md flex flex-col`}>
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
                <h3 className="text-lg font-bold text-white">
                    JL Ассистент
                </h3>
                <button onClick={onClose} className="text-white/70 hover:text-white">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-sm rounded-xl px-4 py-2 ${msg.sender === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-white/10 text-white/90 rounded-bl-none'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                 {isLoading && messages[messages.length - 1]?.sender === 'user' && (
                     <div className="flex gap-3 justify-start">
                         <div className="max-w-xs md:max-w-sm rounded-xl px-4 py-2 bg-white/10 text-white/90 rounded-bl-none">
                            <p className="text-sm animate-pulse">...</p>
                         </div>
                     </div>
                 )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-white/10 shrink-0">
                <form onSubmit={handleSend} className="flex items-center gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Спросите что-нибудь..."
                        className="w-full bg-white/5 p-2 rounded-lg text-sm text-white/90 placeholder:text-white/40 focus:ring-2 focus:ring-primary border-none"
                        disabled={isLoading}
                    />
                    <button type="submit" disabled={isLoading || !input.trim()} className="flex items-center justify-center size-9 rounded-lg bg-primary text-white disabled:bg-gray-500">
                        <span className="material-symbols-outlined">send</span>
                    </button>
                </form>
            </div>
        </div>
    );
};