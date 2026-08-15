import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, X } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ALERTS_DATA } from '../constants';
import { Alert } from '../types';

export const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>(ALERTS_DATA);
  const [showModal, setShowModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const handleAcknowledge = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const handleRequestReplenishment = (alert: Alert) => {
    setSelectedAlert(alert);
    setShowModal(true);
  };

  const confirmOrder = () => {
    // In a real app, this would trigger an API call
    setShowModal(false);
    if (selectedAlert) {
      handleAcknowledge(selectedAlert.id);
    }
    setSelectedAlert(null);
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'Stockout': return <ShieldAlert className="w-5 h-5 text-rose-500" />;
      case 'Critical': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'Low Stock': return <Clock className="w-5 h-5 text-blue-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">Action Center</h2>
        <p className="text-slate-400 text-sm mt-1">Prioritized alerts requiring planner intervention.</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {alerts.map((alert) => (
          <Card key={alert.id} className={`transition-all duration-300 ${alert.acknowledged ? 'opacity-60 bg-slate-900/50' : 'border-l-4'} ${
            !alert.acknowledged && alert.type === 'Stockout' ? 'border-l-rose-500' : 
            !alert.acknowledged && alert.type === 'Critical' ? 'border-l-amber-500' : 
            !alert.acknowledged ? 'border-l-blue-500' : 'border-l-slate-700'
          }`}>
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="flex gap-4 items-start">
                <div className="mt-1 bg-slate-950 p-2 rounded-lg border border-slate-800">
                  {getAlertIcon(alert.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-200">{alert.product}</h3>
                    <span className="text-xs font-mono text-slate-500">{alert.itemId}</span>
                    {alert.acknowledged && <Badge variant="success" className="ml-2"><CheckCircle2 className="w-3 h-3 mr-1"/> Acknowledged</Badge>}
                  </div>
                  <p className="text-sm text-slate-400">{alert.message}</p>
                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {alert.timestamp}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                {!alert.acknowledged && (
                  <Button variant="secondary" size="sm" onClick={() => handleAcknowledge(alert.id)}>
                    Acknowledge
                  </Button>
                )}
                <Button 
                  variant={alert.type === 'Stockout' ? 'danger' : 'primary'} 
                  size="sm"
                  onClick={() => handleRequestReplenishment(alert)}
                  disabled={alert.acknowledged && alert.type !== 'Stockout'}
                >
                  Request Replenishment
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Human Approval Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-rose-500/10">
              <div className="flex items-center gap-2 text-rose-400 font-semibold">
                <ShieldAlert className="w-5 h-5" />
                Human Approval Required
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-300 text-sm">
                You are about to initiate a replenishment order for <strong className="text-slate-100">{selectedAlert?.product}</strong>. 
              </p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm font-mono text-slate-400">
                Policy: RIC-POL-001<br/>
                Rule: Orders exceeding automated thresholds or for critical items require explicit planner authorization.
              </div>
              <p className="text-slate-400 text-sm">
                By confirming, you authorize the procurement system to generate a purchase order based on the recommended quantity.
              </p>
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={confirmOrder}>Authorize Order</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
