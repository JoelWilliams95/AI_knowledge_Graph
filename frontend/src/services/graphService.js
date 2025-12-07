import axios from 'axios';
import { API_BASE } from '../utils/constants';

export const graphService = {
  fetchGraph: async () => {
    const res = await axios.get(`${API_BASE}/graph`);
    return res.data;
  },
};
