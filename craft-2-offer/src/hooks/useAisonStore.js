import { useState, useEffect, useCallback } from 'react';

const STORE_KEY = 'aison_offer';
const COMPANY_KEY = 'aison_company';
const AUTH_KEY = 'aison_vimpl_config';

const defaultOffer = () => ({
  id: crypto.randomUUID(),
  tilbudsnummer: `T-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
  oprettetDato: new Date().toISOString(),
  // Step 1: Interview
  interviewText: '',
  // Step 2: Job description
  jobbeskrivelse: null, // { titel, beskrivelse, omfang, adresse, startdato }
  // Step 3: Tilbud
  tilbud: null, // { linjer, noter, betalingsbetingelser, gyldighedsdage, kunde }
  // Step 4: Projektplan
  projektplan: null, // { faser: [{ navn, opgaver: [string], varighed }] }
  currentStep: 0,
});

const defaultCompany = () => ({
  navn: '',
  cvr: '',
  adresse: '',
  postnr: '',
  by: '',
  telefon: '',
  email: '',
  hjemmeside: '',
});

export function useAisonStore() {
  const [offer, setOfferState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY);
      return stored ? JSON.parse(stored) : defaultOffer();
    } catch {
      return defaultOffer();
    }
  });

  const [company, setCompanyState] = useState(() => {
    try {
      const stored = localStorage.getItem(COMPANY_KEY);
      return stored ? JSON.parse(stored) : defaultCompany();
    } catch {
      return defaultCompany();
    }
  });

  const [auth, setAuthState] = useState(() => {
    try {
      const stored = localStorage.getItem(AUTH_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Persist offer on change
  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(offer));
  }, [offer]);

  // Persist company on change
  useEffect(() => {
    localStorage.setItem(COMPANY_KEY, JSON.stringify(company));
  }, [company]);

  const updateOffer = useCallback((patch) => {
    setOfferState(prev => ({ ...prev, ...patch }));
  }, []);

  const updateCompany = useCallback((patch) => {
    setCompanyState(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem(COMPANY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setStep = useCallback((step) => {
    setOfferState(prev => ({ ...prev, currentStep: step }));
  }, []);

  const newOffer = useCallback(() => {
    const fresh = defaultOffer();
    localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
    setOfferState(fresh);
  }, []);

  const login = useCallback((token, userInfo) => {
    const config = { token, ...userInfo };
    localStorage.setItem(AUTH_KEY, JSON.stringify(config));
    setAuthState(config);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setAuthState(null);
  }, []);

  const isCompanySet = company.navn && company.cvr && company.email;

  return {
    offer,
    updateOffer,
    setStep,
    newOffer,
    company,
    updateCompany,
    isCompanySet,
    auth,
    login,
    logout,
    token: auth?.token ?? null,
  };
}
