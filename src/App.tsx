/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plane, 
  Calendar, 
  Clock, 
  MapPin, 
  ArrowRight, 
  RefreshCw, 
  ChevronLeft,
  Sparkles,
  Search,
  Car,
  Train,
  Ticket,
  CreditCard,
  Home,
  Hotel,
  Bed,
  Palmtree,
  Printer,
  BookOpen,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { generateItinerary, getAirports, RoutePoint } from './gemini';
import { countries } from './constants/countries';
import { TourMap } from './components/TourMap';

const LoadingSpinner = () => (
  <div className="flex justify-center items-center">
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
      className="h-8 w-8 border border-accent-gold/30 border-t-accent-gold rounded-full"
    />
  </div>
);

const getSeason = (dateStr: string) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Autumn';
  return 'Winter';
};

export default function App() {
  const [country, setCountry] = useState('');
  const [airports, setAirports] = useState<string[]>([]);
  const [selectedAirport, setSelectedAirport] = useState('');
  const [numberOfDays, setNumberOfDays] = useState(7);
  const [maxTravelTime, setMaxTravelTime] = useState('2 hours');
  const [arrivalDate, setArrivalDate] = useState('');
  const [transportMode, setTransportMode] = useState<'car' | 'public'>('public');
  const [publicTransportOption, setPublicTransportOption] = useState<'pass' | 'individual'>('pass');
  const [accommodationType, setAccommodationType] = useState('Boutique & Unique');
  const [isWholeCountryTour, setIsWholeCountryTour] = useState(false);
  const [sleeperTrainOption, setSleeperTrainOption] = useState<'none' | 'always' | 'wherever_possible'>('none');
  const [includeEtiquette, setIncludeEtiquette] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [waitingPhraseIndex, setWaitingPhraseIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [itinerary, setItinerary] = useState<{ itinerary: string; imageUrlLocation: string; route: RoutePoint[] } | null>(null);
  const [currentGeneratedDays, setCurrentGeneratedDays] = useState(0);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [bannerImageUrl, setBannerImageUrl] = useState('');

  const season = getSeason(arrivalDate);

  const fancyWaitingPhrases = [
    "Consulting our global network of intelligence...",
    "Finding the best local spots for you...",
    "Putting together your daily schedule...",
    "Checking travel times and routes...",
    "Selecting the perfect accommodations...",
    "Adding some final touches to your trip...",
    "Curating hidden gems and local secrets...",
    "Mapping out the most scenic routes...",
    "Reviewing train schedules and connections...",
    "Ensuring a perfect pace for your journey...",
    "Polishing the final itinerary details...",
    "Almost done, getting everything ready..."
  ];

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setWaitingPhraseIndex((prev) => {
          // Stop at the last phrase, don't cycle back to 0
          if (prev >= fancyWaitingPhrases.length - 1) {
            return prev;
          }
          return prev + 1;
        });
      }, 4000);
      return () => clearInterval(interval);
    } else {
      setWaitingPhraseIndex(0);
    }
  }, [loading]);

  useEffect(() => {
    if (country) {
      const seed = `${country}-${season}`.replace(/\s/g, '-').toLowerCase();
      setBannerImageUrl(`https://picsum.photos/seed/${seed}/1920/400?blur=4`);
    } else {
      setBannerImageUrl(`https://picsum.photos/seed/wanderwise-default/1920/400?blur=4`);
    }
  }, [country, season]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const handleCountryChange = (value: string) => {
    setCountry(value);
    if (value.length >= 2) {
      const filtered = countries.filter(c => 
        c.toLowerCase().startsWith(value.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectCountry = (name: string) => {
    setCountry(name);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleFindAirports = async () => {
    if (!country) {
      setError('Please enter a destination.');
      return;
    }
    setLoading(true);
    setLoadingMessage('Curating your gateway options...');
    setError(null);

    try {
      const result = await getAirports(country);
      setAirports(result);
      setStep(2);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanTrip = async () => {
    if (!selectedAirport) {
      setError('Please select an airport.');
      return;
    }
    setLoading(true);
    setLoadingMessage('Designing your bespoke experience...');
    setError(null);
    setItinerary(null);

    try {
      const initialEndDay = Math.min(numberOfDays, 10);
      const result = await generateItinerary(
        country, 
        selectedAirport, 
        numberOfDays, 
        maxTravelTime,
        transportMode,
        accommodationType,
        publicTransportOption,
        arrivalDate,
        isWholeCountryTour,
        maxTravelTime === '5+ hours' ? sleeperTrainOption : 'none',
        includeEtiquette,
        1,
        initialEndDay
      );
      setItinerary({ itinerary: result.itinerary, imageUrlLocation: result.imageUrlLocation, route: result.route });
      setCurrentGeneratedDays(initialEndDay);
      setBannerImageUrl(`https://picsum.photos/seed/${result.imageUrlLocation.replace(/\s/g, '-')}-${season.toLowerCase()}/1920/400?blur=4`);
      setStep(3);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMore = async () => {
    if (!itinerary) return;
    setIsGeneratingMore(true);
    setError(null);

    const startDay = currentGeneratedDays + 1;
    const endDay = Math.min(numberOfDays, currentGeneratedDays + 10);

    try {
      const result = await generateItinerary(
        country, 
        selectedAirport, 
        numberOfDays, 
        maxTravelTime,
        transportMode,
        accommodationType,
        publicTransportOption,
        arrivalDate,
        isWholeCountryTour,
        maxTravelTime === '5+ hours' ? sleeperTrainOption : 'none',
        includeEtiquette,
        startDay,
        endDay,
        itinerary.itinerary
      );
      
      setItinerary(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          itinerary: prev.itinerary + '\n\n' + result.itinerary,
          route: [...prev.route, ...result.route]
        };
      });
      setCurrentGeneratedDays(endDay);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsGeneratingMore(false);
    }
  };

  const handleStartOver = () => {
    setCountry('');
    setAirports([]);
    setSelectedAirport('');
    setNumberOfDays(7);
    setMaxTravelTime('2 hours');
    setArrivalDate('');
    setTransportMode('public');
    setPublicTransportOption('pass');
    setAccommodationType('Boutique & Unique');
    setIsWholeCountryTour(false);
    setSleeperTrainOption('none');
    setIncludeEtiquette(false);
    setItinerary(null);
    setStep(1);
    setError(null);
  };

  const handlePrint = () => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error('Print failed:', e);
    }
  };

  return (
    <div className="min-h-screen bg-luxury-50 text-deep-navy selection:bg-accent-gold/20 selection:text-deep-navy">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8 print-container relative z-10">
        <header className="text-center mb-20 no-print relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-luxury-200 text-luxury-600 text-xs font-bold tracking-widest uppercase mb-6 shadow-sm"
          >
            <Sparkles size={12} className="text-accent-gold" />
            Bespoke Travel Atelier
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-8xl font-display font-bold text-deep-navy tracking-tighter mb-6"
          >
            Wander<span className="italic font-normal text-accent-gold">Wise</span>
          </motion.h1>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-24 h-1 bg-accent-gold mx-auto mb-6 rounded-full"
          />
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xl text-luxury-600 max-w-2xl mx-auto font-light leading-relaxed"
          >
            Where artificial intelligence meets the art of the journey.
          </motion.p>
        </header>



        <main className="relative z-10">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass-card rounded-[3rem] p-10 md:p-16 no-print"
              >
                <div className="max-w-3xl mx-auto">
                  <h2 className="text-4xl font-display font-bold mb-10 text-deep-navy text-center">
                    Define Your Destination
                  </h2>
                  
                  <div className="space-y-10">
                    <div className="relative group">
                      <label className="text-xs font-bold uppercase tracking-widest text-luxury-400 ml-4 mb-2 block">
                        Destination
                      </label>
                      <div className="relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-luxury-300 group-focus-within:text-accent-gold transition-colors" size={22} />
                        <input
                          type="text"
                          value={country}
                          onChange={(e) => handleCountryChange(e.target.value)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          placeholder="Where shall we take you?"
                          className="w-full pl-16 pr-8 py-6 rounded-3xl border border-luxury-100 bg-white/50 focus:bg-white focus:border-accent-gold focus:ring-0 focus:outline-none transition-all duration-500 text-xl font-medium placeholder:text-luxury-200"
                        />
                      </div>
                      
                      <AnimatePresence>
                        {showSuggestions && suggestions.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-50 left-0 right-0 mt-4 bg-white rounded-[2rem] shadow-2xl border border-luxury-100 overflow-hidden"
                          >
                            {suggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                onClick={() => selectCountry(suggestion)}
                                className="w-full text-left px-8 py-5 hover:bg-luxury-50 transition-colors flex items-center gap-4 border-b border-luxury-50 last:border-0"
                              >
                                <MapPin size={18} className="text-accent-gold" />
                                <span className="font-medium text-deep-navy">{suggestion}</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-luxury-400 ml-4 mb-2 block">
                          Duration
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-luxury-300" size={18} />
                          <select
                            value={numberOfDays}
                            onChange={(e) => setNumberOfDays(Number(e.target.value))}
                            className="w-full pl-12 pr-6 py-5 rounded-2xl border border-luxury-100 bg-white/50 focus:bg-white focus:border-accent-gold focus:outline-none transition-all font-medium text-deep-navy appearance-none cursor-pointer"
                          >
                            {[...Array(40).keys()].map(i => (
                              <option key={i + 1} value={i + 1}>
                                {i + 1} Day{i + 1 > 1 ? 's' : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-luxury-400 ml-4 mb-2 block">
                          Pace
                        </label>
                        <div className="relative">
                          <Clock className="absolute left-5 top-1/2 -translate-y-1/2 text-luxury-300" size={18} />
                          <select
                            value={maxTravelTime}
                            onChange={(e) => setMaxTravelTime(e.target.value)}
                            className="w-full pl-12 pr-6 py-5 rounded-2xl border border-luxury-100 bg-white/50 focus:bg-white focus:border-accent-gold focus:outline-none transition-all font-medium text-deep-navy appearance-none cursor-pointer"
                          >
                            <option value="1 hour">Relaxed (Max 1h/day)</option>
                            <option value="2 hours">Balanced (Max 2h/day)</option>
                            <option value="3 hours">Active (Max 3h/day)</option>
                            <option value="4 hours">Explorer (Max 4h/day)</option>
                            <option value="5+ hours">No Limit</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-luxury-400 ml-4 mb-2 block">
                          Arrival Date
                        </label>
                        <div className="relative">
                          <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 text-luxury-300" size={18} />
                          <input
                            type="date"
                            value={arrivalDate}
                            onChange={(e) => setArrivalDate(e.target.value)}
                            className="w-full pl-12 pr-6 py-5 rounded-2xl border border-luxury-100 bg-white/50 focus:bg-white focus:border-accent-gold focus:outline-none transition-all font-medium text-deep-navy appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {maxTravelTime === '5+ hours' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-accent-gold/5 border border-accent-gold/20 rounded-2xl p-6 mt-6">
                            <label className="text-xs font-bold uppercase tracking-widest text-luxury-400 mb-4 flex items-center gap-2">
                              <Train size={16} className="text-accent-gold" />
                              Overnight & Sleeper Trains
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <button
                                onClick={() => setSleeperTrainOption('none')}
                                className={`p-4 rounded-xl border-2 transition-all font-medium text-sm ${
                                  sleeperTrainOption === 'none'
                                    ? 'border-accent-gold bg-white text-deep-navy shadow-sm'
                                    : 'border-transparent bg-white/50 text-luxury-400 hover:bg-white'
                                }`}
                              >
                                Not Preferred
                              </button>
                              <button
                                onClick={() => setSleeperTrainOption('wherever_possible')}
                                className={`p-4 rounded-xl border-2 transition-all font-medium text-sm ${
                                  sleeperTrainOption === 'wherever_possible'
                                    ? 'border-accent-gold bg-white text-deep-navy shadow-sm'
                                    : 'border-transparent bg-white/50 text-luxury-400 hover:bg-white'
                                }`}
                              >
                                Wherever Possible
                              </button>
                              <button
                                onClick={() => setSleeperTrainOption('always')}
                                className={`p-4 rounded-xl border-2 transition-all font-medium text-sm ${
                                  sleeperTrainOption === 'always'
                                    ? 'border-accent-gold bg-white text-deep-navy shadow-sm'
                                    : 'border-transparent bg-white/50 text-luxury-400 hover:bg-white'
                                }`}
                              >
                                Always Use Them
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-6">
                      <label className="text-xs font-bold uppercase tracking-widest text-luxury-400 text-center block">
                        Travel Philosophy
                      </label>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="flex gap-3">
                            <button
                              onClick={() => setTransportMode('public')}
                              className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all font-bold ${
                                transportMode === 'public' 
                                  ? 'border-accent-gold bg-luxury-100 text-deep-navy shadow-inner' 
                                  : 'border-luxury-50 text-luxury-300 hover:border-luxury-100'
                              }`}
                            >
                              <Train size={20} /> Public
                            </button>
                            <button
                              onClick={() => setTransportMode('car')}
                              className={`flex-1 flex items-center justify-center gap-3 p-5 rounded-2xl border-2 transition-all font-bold ${
                                transportMode === 'car' 
                                  ? 'border-accent-gold bg-luxury-100 text-deep-navy shadow-inner' 
                                  : 'border-luxury-50 text-luxury-300 hover:border-luxury-100'
                              }`}
                            >
                              <Car size={20} /> Private
                            </button>
                          </div>
                          
                          <AnimatePresence mode="wait">
                            {transportMode === 'public' ? (
                              <motion.div
                                key="public-options"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="flex gap-2"
                              >
                                <button
                                  onClick={() => setPublicTransportOption('pass')}
                                  className={`flex-1 py-3 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest ${
                                    publicTransportOption === 'pass' ? 'bg-deep-navy text-white border-deep-navy' : 'bg-white text-luxury-400 border-luxury-100'
                                  }`}
                                >
                                  Tourist Pass
                                </button>
                                <button
                                  onClick={() => setPublicTransportOption('individual')}
                                  className={`flex-1 py-3 rounded-xl border transition-all text-[10px] font-bold uppercase tracking-widest ${
                                    publicTransportOption === 'individual' ? 'bg-deep-navy text-white border-deep-navy' : 'bg-white text-luxury-400 border-luxury-100'
                                  }`}
                                >
                                  Single Tickets
                                </button>
                              </motion.div>
                            ) : (
                              <motion.div
                                key="car-note"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="p-4 rounded-xl bg-white border border-luxury-100 text-[10px] leading-relaxed text-luxury-500 italic"
                              >
                                <p>Your dossier will include essential details on local road rules, toll systems, and license requirements.</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { id: 'Luxury Hotels', icon: Palmtree, label: 'Luxury' },
                            { id: 'Boutique & Unique', icon: Hotel, label: 'Boutique' },
                            { id: 'Budget Friendly', icon: Bed, label: 'Budget' },
                            { id: 'Local Guesthouses', icon: Home, label: 'Local' },
                          ].map((type) => (
                            <button
                              key={type.id}
                              onClick={() => setAccommodationType(type.id)}
                              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                                accommodationType === type.id 
                                  ? 'border-accent-gold bg-luxury-100 text-deep-navy shadow-inner' 
                                  : 'border-luxury-50 text-luxury-300 hover:border-luxury-100'
                              }`}
                            >
                              <type.icon size={18} className={accommodationType === type.id ? 'text-accent-gold' : ''} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">{type.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="text-xs font-bold uppercase tracking-widest text-luxury-400 text-center block">
                        Cultural Insights
                      </label>
                      <div className="bg-white/50 border border-luxury-100 rounded-2xl p-6 flex items-center justify-between transition-all hover:bg-white">
                        <div className="flex items-center gap-4">
                          <div className="bg-luxury-100 p-3 rounded-xl text-accent-gold">
                            <BookOpen size={20} />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-deep-navy">Local Etiquette & Customs</h3>
                            <p className="text-[10px] text-luxury-500 mt-1">Include social norms, greetings, dress codes, and tipping practices for each destination.</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIncludeEtiquette(!includeEtiquette)}
                          className="text-accent-gold hover:text-deep-navy transition-colors"
                        >
                          {includeEtiquette ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-luxury-300" />}
                        </button>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.01, backgroundColor: '#1a2238' }}
                      whileTap={{ scale: 0.99 }}
                      onClick={handleFindAirports}
                      disabled={loading || !country}
                      className="w-full luxury-gradient text-white py-6 rounded-3xl font-bold text-xl shadow-2xl shadow-deep-navy/20 hover:shadow-deep-navy/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 mt-8"
                    >
                      {loading ? <LoadingSpinner /> : (
                        <>
                          Begin Curation <ArrowRight size={22} />
                        </>
                      )}
                    </motion.button>
                  </div>
                  {error && (
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-red-600 mt-8 text-center font-medium bg-red-50/50 py-4 rounded-2xl border border-red-100"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card rounded-[3rem] p-10 md:p-16 no-print"
              >
                <div className="max-w-3xl mx-auto">
                  <h2 className="text-4xl font-display font-bold mb-4 text-deep-navy text-center">Select Your Gateway</h2>
                  <p className="text-luxury-400 text-center mb-12 font-light italic">
                    Choose the starting point for your {country} odyssey
                  </p>

                  {numberOfDays >= 35 && numberOfDays <= 40 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-accent-gold/10 border border-accent-gold/20 rounded-2xl p-6 mb-12 text-center flex flex-col items-center gap-4"
                    >
                      <p className="text-deep-navy font-medium flex items-center justify-center gap-2 flex-wrap">
                        <Sparkles className="w-5 h-5 text-accent-gold flex-shrink-0" />
                        <span>With {numberOfDays} days, you have the perfect opportunity for a comprehensive <strong>Whole Country Tour</strong>!</span>
                      </p>
                      
                      <label className="flex items-center cursor-pointer gap-3 bg-white/50 px-6 py-3 rounded-full border border-accent-gold/30 hover:bg-white transition-colors">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            className="sr-only" 
                            checked={isWholeCountryTour}
                            onChange={(e) => setIsWholeCountryTour(e.target.checked)}
                          />
                          <div className={`block w-14 h-8 rounded-full transition-colors ${isWholeCountryTour ? 'bg-accent-gold' : 'bg-luxury-200'}`}></div>
                          <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isWholeCountryTour ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                        <span className="text-sm font-bold text-deep-navy uppercase tracking-wider">
                          Enable Whole Country Tour
                        </span>
                      </label>
                    </motion.div>
                  )}
                  
                  <div className="grid grid-cols-1 gap-4 mb-12">
                    {airports.map((airport) => (
                      <motion.label
                        key={airport}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={`flex items-center p-8 border-2 rounded-[2rem] cursor-pointer transition-all duration-300 ${
                          selectedAirport === airport 
                            ? 'border-accent-gold bg-luxury-100 ring-8 ring-accent-gold/5' 
                            : 'border-luxury-50 hover:border-luxury-200 hover:bg-white'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full border-2 mr-6 flex items-center justify-center transition-all ${
                          selectedAirport === airport ? 'border-accent-gold bg-accent-gold' : 'border-luxury-200'
                        }`}>
                          {selectedAirport === airport && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                        </div>
                        <input
                          type="radio"
                          name="airport"
                          value={airport}
                          checked={selectedAirport === airport}
                          onChange={() => setSelectedAirport(airport)}
                          className="hidden"
                        />
                        <div className="flex items-center gap-4">
                          <Plane size={24} className={selectedAirport === airport ? 'text-accent-gold' : 'text-luxury-300'} />
                          <span className={`text-xl font-display font-bold ${selectedAirport === airport ? 'text-deep-navy' : 'text-luxury-400'}`}>
                            {airport}
                          </span>
                        </div>
                      </motion.label>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-6">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 px-10 py-6 rounded-3xl font-bold text-luxury-600 border border-luxury-200 hover:bg-white transition-all flex items-center justify-center gap-3"
                    >
                      <ChevronLeft size={22} /> Back
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={handlePlanTrip}
                      disabled={loading || !selectedAirport}
                      className="flex-[2] luxury-gradient text-white py-6 rounded-3xl font-bold text-xl shadow-2xl shadow-deep-navy/20 hover:shadow-deep-navy/40 transition-all disabled:opacity-50 flex items-center justify-center gap-4"
                    >
                      {loading ? <LoadingSpinner /> : (
                        <>
                          Finalize Itinerary <Sparkles size={22} />
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && itinerary && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-12"
              >
                {/* Itinerary Hero */}
                <div className="relative h-[400px] rounded-[4rem] overflow-hidden shadow-2xl print-hero">
                  {bannerImageUrl && (
                    <motion.img
                      key={bannerImageUrl} // Key to force re-render and animation on URL change
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      src={bannerImageUrl}
                      alt="Travel Banner"
                      className="absolute inset-0 w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-deep-navy via-deep-navy/40 to-transparent" />
                  <div className="absolute bottom-12 left-12 right-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-4">
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-gold text-white text-xs font-bold tracking-widest uppercase">
                        {season} Collection
                      </div>
                      <h2 className="text-5xl md:text-7xl font-display font-bold text-white tracking-tighter">
                        {country} <span className="italic font-normal text-accent-gold/80">Experience</span>
                      </h2>
                      <p className="text-luxury-100 flex items-center gap-4 font-light text-lg">
                        <span className="flex items-center gap-2"><MapPin size={18} className="text-accent-gold" /> {selectedAirport}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50" />
                        <span className="flex items-center gap-2"><Calendar size={18} className="text-accent-gold" /> {numberOfDays} Days</span>
                        {arrivalDate && (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-accent-gold/50" />
                            <span className="flex items-center gap-2"><Clock size={18} className="text-accent-gold" /> {new Date(arrivalDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 no-print">
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all shadow-xl cursor-pointer"
                      >
                        <Printer size={20} /> Print PDF
                      </button>
                      <button
                        onClick={handleStartOver}
                        className="flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all shadow-xl"
                      >
                        <RefreshCw size={20} /> New Curation
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  {/* Main Content */}
                  <div className="lg:col-span-8 space-y-12 print-content">
                    <div className="glass-card rounded-[3rem] p-10 md:p-16">
                      <div className="prose prose-luxury prose-lg max-w-none 
                        prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-deep-navy
                        prose-h2:text-4xl prose-h2:mb-10 prose-h2:mt-16 first:prose-h2:mt-0 prose-h2:pb-4 prose-h2:border-b prose-h2:border-luxury-100
                        prose-h3:text-lg prose-h3:text-accent-gold prose-h3:mt-12 prose-h3:mb-6 prose-h3:uppercase prose-h3:tracking-[0.3em] prose-h3:font-bold prose-h3:flex prose-h3:items-center prose-h3:gap-4
                        prose-p:text-luxury-800 prose-p:leading-relaxed prose-p:mb-8 prose-p:font-light
                        prose-li:text-luxury-700 prose-li:mb-4
                        prose-strong:text-deep-navy prose-strong:font-bold
                        prose-hr:border-luxury-100 prose-hr:my-16
                      ">
                      <ReactMarkdown
                        components={{
                          a: ({ node, ...props }) => {
                            const isWiki = props.href?.includes('wikipedia.org');
                            return (
                              <a 
                                {...props} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={`inline-flex items-center gap-1 font-bold no-underline hover:underline ${isWiki ? 'text-black' : 'text-accent-gold'}`} 
                              />
                            );
                          },
                          h3: ({ node, ...props }) => (
                            <h3 {...props} className="flex items-center gap-3 after:content-[''] after:flex-1 after:h-[1px] after:bg-luxury-200" />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2 {...props} className="flex items-center gap-4" />
                          )
                        }}
                      >
                        {itinerary.itinerary.replace(/\$\rightarrow\$/g, '→').replace(/\\rightarrow/g, '→')}
                      </ReactMarkdown>
                      
                      {currentGeneratedDays < numberOfDays && (
                        <div className="mt-16 pt-12 border-t border-luxury-100 flex justify-center no-print">
                          {isGeneratingMore ? (
                            <div className="flex flex-col items-center gap-4 text-luxury-400">
                              <motion.div 
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                              >
                                <RefreshCw size={32} />
                              </motion.div>
                              <p className="font-light italic">Curating days {currentGeneratedDays + 1} to {Math.min(numberOfDays, currentGeneratedDays + 10)}...</p>
                            </div>
                          ) : (
                            <button
                              onClick={handleGenerateMore}
                              className="px-8 py-4 rounded-2xl luxury-gradient text-white font-bold shadow-xl hover:shadow-2xl transition-all flex items-center gap-3"
                            >
                              <Sparkles size={20} />
                              Generate Days {currentGeneratedDays + 1} to {Math.min(numberOfDays, currentGeneratedDays + 10)}
                            </button>
                          )}
                        </div>
                      )}
                      </div>
                    </div>
                  </div>

                  {/* Sidebar */}
                  <div className="lg:col-span-4 space-y-8 no-print">
                    <div className="glass-card rounded-[2.5rem] p-8 sticky top-8">
                      <h3 className="text-2xl font-display font-bold mb-8 text-deep-navy flex items-center gap-3">
                        <Sparkles size={20} className="text-accent-gold" />
                        Travel Dossier
                      </h3>
                      
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-luxury-400">Transport Strategy</p>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setTransportMode('public')}
                                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-xs font-bold ${
                                  transportMode === 'public' 
                                    ? 'border-accent-gold bg-luxury-100 text-deep-navy' 
                                    : 'border-luxury-100 text-luxury-300 hover:border-luxury-200'
                                }`}
                              >
                                <Train size={14} /> Public
                              </button>
                              <button
                                onClick={() => setTransportMode('car')}
                                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border transition-all text-xs font-bold ${
                                  transportMode === 'car' 
                                    ? 'border-accent-gold bg-luxury-100 text-deep-navy' 
                                    : 'border-luxury-100 text-luxury-300 hover:border-luxury-200'
                                }`}
                              >
                                <Car size={14} /> Private
                              </button>
                            </div>
                            {transportMode === 'car' && (
                              <div className="p-3 rounded-xl bg-white border border-luxury-100 text-[9px] leading-tight text-luxury-400 italic">
                                Includes road rules, tolls, & license requirements
                              </div>
                            )}
                            {transportMode === 'public' && (
                              <select
                                value={publicTransportOption}
                                onChange={(e) => setPublicTransportOption(e.target.value as any)}
                                className="w-full px-4 py-2 rounded-xl border border-luxury-100 bg-luxury-50 text-[10px] font-bold uppercase tracking-wider text-luxury-600 focus:outline-none focus:border-accent-gold"
                              >
                                <option value="pass">Tourist Pass</option>
                                <option value="individual">Single Tickets</option>
                              </select>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-luxury-400">Lodging Philosophy</p>
                          <select
                            value={accommodationType}
                            onChange={(e) => setAccommodationType(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-luxury-100 bg-luxury-50 text-xs font-bold text-deep-navy focus:outline-none focus:border-accent-gold appearance-none cursor-pointer"
                          >
                            <option value="Luxury Hotels">Luxury Hotels</option>
                            <option value="Boutique & Unique">Boutique & Unique</option>
                            <option value="Budget Friendly">Budget Friendly</option>
                            <option value="Local Guesthouses">Local Guesthouses</option>
                          </select>
                        </div>

                        <div className="space-y-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-luxury-400">Daily Rhythm</p>
                          <select
                            value={maxTravelTime}
                            onChange={(e) => setMaxTravelTime(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-luxury-100 bg-luxury-50 text-xs font-bold text-deep-navy focus:outline-none focus:border-accent-gold appearance-none cursor-pointer"
                          >
                            <option value="1 hour">Relaxed (1h max)</option>
                            <option value="2 hours">Balanced (2h max)</option>
                            <option value="3 hours">Active (3h max)</option>
                            <option value="4 hours">Explorer (4h max)</option>
                            <option value="5+ hours">No Limit</option>
                          </select>
                        </div>

                        <div className="pt-4">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handlePlanTrip}
                            className="w-full py-4 rounded-2xl luxury-gradient text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2"
                          >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            Update Itinerary
                          </motion.button>
                        </div>

                        {itinerary?.route && itinerary.route.length > 0 && (
                          <div className="pt-6 border-t border-luxury-100">
                            <TourMap route={itinerary.route} country={country} />
                          </div>
                        )}

                        <div className="pt-6 border-t border-luxury-100">
                          <div className="p-6 rounded-[2rem] luxury-gradient text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                              <Sparkles size={80} />
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-3 opacity-60">Concierge Note</p>
                            <p className="text-sm font-light leading-relaxed italic">
                              "{`Your ${numberOfDays > 10 ? 'grand expedition' : 'refined escape'} through ${country} has been meticulously curated to harmonize ${arrivalDate ? getSeason(arrivalDate).toLowerCase() + ' radiance with' : ''} elite logistical efficiency and profound cultural discovery.`}"
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 bg-luxury-50/90 backdrop-blur-xl flex flex-col items-center justify-center z-[100]"
            >
              <div className="relative">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ repeat: Infinity, duration: 4 }}
                  className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-2xl border border-luxury-100"
                >
                  <Plane size={48} className="text-accent-gold" />
                </motion.div>
                <div className="absolute -bottom-4 -right-4">
                  <LoadingSpinner />
                </div>
              </div>
              <p className="mt-12 text-3xl font-display font-bold text-deep-navy tracking-tight">{loadingMessage}</p>
              <div className="h-8 mt-3 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.p 
                    key={waitingPhraseIndex}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.5 }}
                    className="text-luxury-400 font-light italic"
                  >
                    {fancyWaitingPhrases[waitingPhraseIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </main>
      </div>
      
      <footer className="mt-32 py-20 border-t border-luxury-100 text-center no-print">
        <div className="max-w-xs mx-auto space-y-6">
          <h4 className="text-2xl font-display font-bold text-deep-navy">WanderWise</h4>
          <p className="text-luxury-400 text-xs font-bold uppercase tracking-[0.3em]">
            Excellence in Exploration
          </p>
          <div className="flex justify-center gap-4 text-luxury-300">
            <Sparkles size={16} />
            <Plane size={16} />
            <MapPin size={16} />
          </div>
        </div>
      </footer>
    </div>
  );
}
