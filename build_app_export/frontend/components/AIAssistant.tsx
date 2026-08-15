import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, ShieldCheck, ChevronDown, ChevronRight, Terminal, FileText, Database } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { ChatMessage } from '../types';

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    content: 'Hello. I am the Refractory Inventory Agent. I can analyze stock levels, forecast demand, and recommend replenishment actions based on current policies. How can I assist you today?'
  }
];

const SUGGESTED_QUESTIONS = [
  "Why is ITM-1003 out of stock?",
  "What is the recommended order for MC-15?",
  "Show me items below safety stock in Houston."
];

export const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [expandedTrace, setExpandedTrace] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    const newUserMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response specifically tailored to the prompt requirement
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Based on the current inventory levels and demand forecast, I recommend ordering **102 units** of Magnesia-Carbon Brick (MC-15) for the Houston warehouse. \n\nThis quantity accounts for the current deficit below safety stock and covers the projected demand for the next 4 weeks. Please note that per policy, orders of this size require human approval.",
        citations: [
          { id: 'c1', text: 'Inventory DB: ITM-1002 Status' },
          { id: 'c2', text: 'Policy: RIC-POL-001 (Approval Thresholds)' }
        ],
        toolTrace: [
          { name: 'query_inventory', status: 'success', details: 'SELECT on_hand, safety_stock FROM inventory WHERE id="ITM-1002"' },
          { name: 'get_demand_forecast', status: 'success', details: 'Fetched 4-week forecast for MC-15 in Houston region.' },
          { name: 'check_policy_rag', status: 'success', details: 'Matched intent with RIC-POL-001: "Orders > 100 units require planner authorization."' }
        ]
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 animate-in fade-in duration-500">
      
      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col h-full" noPadding>
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Bot className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200">Planner Assistant</h3>
            <p className="text-xs text-slate-400">Powered by Agent Studio</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-700' : 'bg-blue-600'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-slate-300" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              
              <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-sm' 
                    : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700'
                }`}>
                  {/* Simple markdown rendering for bold text */}
                  {msg.content.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-white font-semibold">{part}</strong> : part)}
                </div>

                {/* Citations */}
                {msg.citations && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {msg.citations.map(cite => (
                      <Badge key={cite.id} variant="info" className="text-[10px] py-0 px-1.5 flex items-center gap-1 cursor-help" title={cite.text}>
                        <FileText className="w-3 h-3" /> [{cite.id}] {cite.text.substring(0, 15)}...
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Tool Trace */}
                {msg.toolTrace && (
                  <div className="w-full mt-2 border border-slate-700 rounded-lg overflow-hidden bg-slate-900/50">
                    <button 
                      onClick={() => setExpandedTrace(expandedTrace === msg.id ? null : msg.id)}
                      className="w-full flex items-center justify-between p-2 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3 h-3" />
                        <span>Agent Execution Trace ({msg.toolTrace.length} steps)</span>
                      </div>
                      {expandedTrace === msg.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                    
                    {expandedTrace === msg.id && (
                      <div className="p-2 border-t border-slate-800 space-y-2 bg-slate-950 font-mono text-[10px]">
                        {msg.toolTrace.map((step, idx) => (
                          <div key={idx} className="flex gap-2 text-slate-500">
                            <span className="text-slate-600">[{idx+1}]</span>
                            <div>
                              <span className="text-blue-400">{step.name}</span>
                              <span className="text-slate-600"> - </span>
                              <span className={step.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}>{step.status}</span>
                              <div className="mt-0.5 text-slate-400 break-all">{step.details}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm p-4 flex gap-1 items-center">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button 
                key={i}
                onClick={() => handleSend(q)}
                className="whitespace-nowrap text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="relative">
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(inputValue)}
              placeholder="Ask about inventory, policies, or demand..." 
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-4 pr-12 py-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            <button 
              onClick={() => handleSend(inputValue)}
              disabled={!inputValue.trim() || isTyping}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Agent Card (Sidebar) */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        <Card>
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-800">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            <div>
              <h3 className="font-semibold text-slate-200">Agent Card</h3>
              <p className="text-xs text-slate-400">Security & Capabilities</p>
            </div>
          </div>
          
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Identity</span>
              <p className="text-slate-200 mt-1 font-mono text-xs bg-slate-950 p-2 rounded border border-slate-800">agent-refractory-planner-v2</p>
            </div>
            
            <div>
              <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Authorization Scope</span>
              <ul className="mt-1 space-y-1">
                <li className="flex items-center gap-2 text-slate-300"><Database className="w-3 h-3 text-blue-400"/> Read: Inventory DB</li>
                <li className="flex items-center gap-2 text-slate-300"><FileText className="w-3 h-3 text-blue-400"/> Read: Policy RAG</li>
                <li className="flex items-center gap-2 text-slate-300"><Terminal className="w-3 h-3 text-amber-400"/> Execute: Draft Order</li>
              </ul>
            </div>

            <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold block mb-1">Spending Limit</span>
                <Badge variant="danger" className="font-mono">USD 0.00</Badge>
              </div>
              <div>
                <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold block mb-1">Human Approval</span>
                <Badge variant="warning" className="font-mono">REQUIRED</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
