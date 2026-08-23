import React from 'react';
import SystemMicroserviceNode from '../features/node_types/SystemMicroserviceNode';
import SystemDatabaseNode from '../features/node_types/SystemDatabaseNode';
import SystemGatewayNode from '../features/node_types/SystemGatewayNode';

export default function SystemDesignCard({ node, isSelected, onSelect, onOpenInspector }) {
  const category = node.nodeCategory || 'microservice';

  const renderContent = () => {
    switch (category) {
      case 'database':
        return <SystemDatabaseNode node={node} onOpenInspector={onOpenInspector} />;
      case 'gateway':
        return <SystemGatewayNode node={node} onOpenInspector={onOpenInspector} />;
      default:
        return <SystemMicroserviceNode node={node} onOpenInspector={onOpenInspector} />;
    }
  };

  return (
    <div
      className={`system-card ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        transform: `translate(${node.x}px, ${node.y}px)`,
        width: node.width || 220,
        height: node.height || 140,
        borderRadius: '14px',
        boxSizing: 'border-box',
        zIndex: isSelected ? 20 : 10
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
    >
      {renderContent()}
    </div>
  );
}
