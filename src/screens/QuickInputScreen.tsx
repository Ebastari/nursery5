import { Button } from '../components/Button';
import { ExternalLink, Smartphone } from 'lucide-react';

export function QuickInputScreen() {
  const handleOpenAppSheet = () => {
    window.open('https://www.appsheet.com/start/0c6e4948-4c31-419f-a1d7-d6d897d4d742?platform=desktop#appName=Nurseryapkbaru-863683625&vss=H4sIAAAAAAAAA6WPMU_DMBCF_8vNzuAmNNQjiKFC7QJiwQyOfZZOpHYVX4Aq8n_HbkHMFeN7p-_dewt8EH4-sbHvoF6XP_WIJ1CwaHg-HVGD0nAfA09x1CA07M3hYt7RQKwhQ34TvzBjArVcwap__BVADgOTJ5xqUMVKwA9UzhUpxhmALOAwsxlGPPesAKVteHDEu-iK5mlGATyZkIxlimHrCty21q03_aaRVsqmk75thhvpm1vXd6t-7Tqz6iDnku6jnRO6lzLn2hm1x9fRBHdp4s2YMH8D838wCqABAAA=&view=Bibit', '_blank');
  };

  return (
    <div className="fade-in flex flex-col items-center justify-center min-h-[70vh] space-y-8 pb-24">
      <div className="text-center max-w-md mx-auto space-y-4">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center">
          <Smartphone className="w-10 h-10 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Input Aktivitas Bibit
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Buka formulir AppSheet untuk input data
          </p>
          <p className="text-sm text-gray-500">
            Formulir akan terbuka dalam aplikasi (tidak keluar browser)
          </p>
        </div>
      </div>

      <Button 
        size="lg" 
        variant="primary"
        onClick={handleOpenAppSheet}
        className="w-full max-w-md shadow-2xl shadow-emerald-500/25 !px-8 !py-5"
      >
        <ExternalLink className="w-5 h-5 mr-2" />
        Buka AppSheet Input
      </Button>

      <div className="text-center text-xs text-gray-400 space-y-1 pt-8">
        <p>Formulir otomatis & terintegrasi</p>
        <p>✅ Data tersimpan langsung ke sistem nursery</p>
      </div>
    </div>
  );
}
