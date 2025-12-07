import { createContext, useContext } from 'react';

const GraphContext = createContext();

export const GraphProvider = ({ children, value }) => {
  return (
    <GraphContext.Provider value={value}>
      {children}
    </GraphContext.Provider>
  );
};

export const useGraphContext = () => {
  const context = useContext(GraphContext);
  if (!context) {
    throw new Error('useGraphContext must be used within GraphProvider');
  }
  return context;
};
