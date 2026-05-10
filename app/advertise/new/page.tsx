'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { hasAdvertiserRole } from '@/lib/profile-roles';
import { CircleCheck as CheckCircle, CircleAlert as AlertCircle, ChevronRight } from 'lucide-react';

const ADD_ADVERTISER_ROLE_MSG =
  'Add advertiser role to your account to create and manage ads.';
const NEED_LOGIN_ADVERTISER_MSG = 'Please log in with your advertiser account at /advertise/login.';

const PACKAGES = [
  { days: 7,  pence: 5900,  label: '7 days',  price: '£59',  description: 'Ideal for short campaigns and announcements.' },
  { days: 14, pence: 9900,  label: '14 days', price: '£99',  description: 'A fortnight of visibility across our pages.', popular: true },
  { days: 30, pence: 17900, label: '30 days', price: '£179', description: 'One month of sustained brand awareness.' },
  { days: 60, pence: 29900, label: '60 days', price: '£299', description: 'Two months of sustained global exposure.' },
  { days: 90, pence: 39900, label: '90 days', price: '£399', description: 'Best value — three months for maximum impact.' },
];

type Step = 1 | 2 | 3;

type AdContent = {
  company_name: string;
  title: string;
  copy: string;
  destination_url: string;
  image_file: File | null;
  image_url: string;
  video_url: string;
};

const EMPTY_CONTENT: AdContent = {
  company_name: '', title: '', copy: '', destination_url: '',
  image_file: null, image_url: '', video_url: '',
};

export default function NewAdPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft');

  const [step, setStep] = useState<Step>(1);
  const [content, setContent] = useState<AdContent>(EMPTY_CONTENT);
  const [selectedPkg, setSelectedPkg] = useState<typeof PACKAGES[0] | null>(null);
  const [adId, setAdId] = useState<string | null>(draftId);
  const [userId, setUserId] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [canAdvertiserSave, setCanAdvertiserSave] = useState(true);
  const [addRoleBusy, setAddRoleBusy] = useState(false);
  const [addRoleError, setAddRoleError] = useState('');

  const [moderating, setModerating] = useState(false);
  const [modError, setModError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [imagePreview, setImagePreview] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/advertise/login');
  };

  /** Current auth user must be role `advertiser` to save ads. Returns user id if ok. */
  const getAdvertiserUserIdForSave = async (): Promise<string | null> => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles, role')
      .eq('id', user.id)
      .maybeSingle();

    if (!hasAdvertiserRole(profile)) return null;

    setUserId(user.id);
    return user.id;
  };

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push('/advertise/login');
        setBooting(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('roles, role')
        .eq('id', user.id)
        .maybeSingle();

      if (!hasAdvertiserRole(profile)) {
        setCanAdvertiserSave(false);
        setBooting(false);
        return;
      }

      setCanAdvertiserSave(true);

      setUserId(user.id);

      if (draftId) {
        const { data } = await supabase.from('advertisements').select('*').eq('id', draftId).maybeSingle();
        if (data) {
          setContent({
            company_name: data.company_name || '',
            title: data.title || '',
            copy: data.copy || '',
            destination_url: data.destination_url || '',
            image_file: null,
            image_url: data.image_url || '',
            video_url: data.video_url || '',
          });
          if (data.image_url) setImagePreview(data.image_url);
          const pkg = PACKAGES.find((p) => p.days === data.package_days);
          if (pkg) setSelectedPkg(pkg);
        }
      }
      setBooting(false);
    })();
  }, [draftId, router]);


  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContent((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('Only JPG and PNG images are accepted.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB.');
      return;
    }

    setContent((prev) => ({ ...prev, image_file: file }));
    setImagePreview(URL.createObjectURL(file));
  };

  const saveDraft = async (): Promise<string | null> => {
    const uid = await getAdvertiserUserIdForSave();
    if (!uid) {
      setSubmitError(canAdvertiserSave ? NEED_LOGIN_ADVERTISER_MSG : ADD_ADVERTISER_ROLE_MSG);
      return null;
    }

    const payload = {
      user_id: uid,
      company_name: content.company_name,
      title: content.title,
      copy: content.copy,
      destination_url: content.destination_url,
      image_url: content.image_url,
      video_url: content.video_url,
      package_days: selectedPkg?.days || 30,
      package_price_pence: selectedPkg?.pence || 0,
      status: 'draft',
      updated_at: new Date().toISOString(),
    };

    if (adId) {
      const { error } = await supabase.from('advertisements').update(payload).eq('id', adId);
      if (error) {
        console.error('[saveDraft] update', error);
        return null;
      }
      return adId;
    }
    const { data, error } = await supabase
      .from('advertisements')
      .insert(payload)
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('[saveDraft] insert', error);
      return null;
    }
    if (data?.id) {
      setAdId(data.id);
      return data.id;
    }
    return null;
  };

  /** Persist ad with status `pending` before moderation + checkout (checkout accepts pending / pending_review). */
  const saveAdPending = async (uid: string): Promise<string | null> => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('roles, role')
      .eq('id', uid)
      .maybeSingle();
    if (!hasAdvertiserRole(profile)) {
      setSubmitError(ADD_ADVERTISER_ROLE_MSG);
      return null;
    }

    if (!selectedPkg) return null;
    console.log('Saving ad...');
    const payload = {
      user_id: uid,
      company_name: content.company_name,
      title: content.title,
      copy: content.copy,
      destination_url: content.destination_url,
      image_url: content.image_url,
      video_url: content.video_url,
      package_days: selectedPkg.days,
      package_price_pence: selectedPkg.pence,
      status: 'pending',
      updated_at: new Date().toISOString(),
    };

    if (adId) {
      const { error } = await supabase.from('advertisements').update(payload).eq('id', adId);
      if (error) {
        console.error('[saveAdPending] update', error);
        return null;
      }
      return adId;
    }
    const { data, error } = await supabase
      .from('advertisements')
      .insert(payload)
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('[saveAdPending] insert', error);
      return null;
    }
    if (!data?.id) return null;
    setAdId(data.id);
    return data.id;
  };

  const proceedToStep2 = async () => {
    if (!content.company_name || !content.title || !content.copy || !content.destination_url) {
      alert('Please fill in all required fields.');
      return;
    }
    const id = await saveDraft();
    if (!id) {
      alert('Could not save your ad. Check you are signed in and try again.');
      return;
    }
    setStep(2);
  };

  const proceedToStep3 = async () => {
    if (!selectedPkg) {
      alert('Please select a package.');
      return;
    }
    const id = await saveDraft();
    if (!id) {
      alert('Could not save your ad. Please try again.');
      return;
    }
    setStep(3);
  };

  const runModerationAndPay = async () => {
    setModError('');
    setSubmitError('');

    if (!selectedPkg) {
      setSubmitError('Please select a package before paying.');
      return;
    }

    const uid = await getAdvertiserUserIdForSave();
    if (!uid) {
      setSubmitError(canAdvertiserSave ? NEED_LOGIN_ADVERTISER_MSG : ADD_ADVERTISER_ROLE_MSG);
      return;
    }

    setModerating(true);

    const effectiveAdId = await saveAdPending(uid);
    if (!effectiveAdId) {
      setSubmitError('Could not save your ad. Please try again.');
      setModerating(false);
      return;
    }
    console.log('Ad saved:', effectiveAdId);

    let uploadedImageUrl = content.image_url;

    if (content.image_file) {
      const formData = new FormData();
      formData.append('file', content.image_file);
      formData.append('adId', effectiveAdId);

      const uploadRes = await fetch('/api/advertiser/upload-image', {
        method: 'PUT',
        body: formData,
      });

      if (!uploadRes.ok) {
        setModError('Image upload failed. Please try again.');
        setModerating(false);
        return;
      }

      const { url } = await uploadRes.json();
      uploadedImageUrl = url;
      await supabase.from('advertisements').update({ image_url: uploadedImageUrl }).eq('id', effectiveAdId);
    }

    const modRes = await fetch('/api/advertiser/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adId: effectiveAdId,
        title: content.title,
        copy: content.copy,
        destination_url: content.destination_url,
        image_url: uploadedImageUrl,
      }),
    });

    const modData = await modRes.json();

    if (!modData.passed) {
      setModError(modData.reason || 'Your ad did not pass content moderation. Please review and revise.');
      setModerating(false);
      return;
    }

    setModerating(false);
    setSubmitting(true);

    const packagePricePence = Math.round(selectedPkg.pence);
    console.log('Creating checkout session...');

    const checkoutRes = await fetch('/api/advertiser/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        advertiser_id: uid,
        ad_id: effectiveAdId,
        package_days: selectedPkg.days,
        package_price: packagePricePence,
        ad_title: content.title,
        company_name: content.company_name,
      }),
    });

    const checkoutData = await checkoutRes.json();

    if (!checkoutRes.ok || !checkoutData.url) {
      const msg =
        typeof checkoutData.error === 'string'
          ? checkoutData.error
          : 'Failed to start payment. Please try again or contact support@groundviewnews.com.';
      setSubmitError(msg);
      setSubmitting(false);
      return;
    }

    const checkoutUrl = checkoutData.url as string;
    console.log('Checkout URL:', checkoutUrl);
    window.location.href = checkoutUrl;
  };

  const isProcessing = moderating || submitting;

  const handleAddAdvertiserRole = async () => {
    setAddRoleError('');
    setAddRoleBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id || !user.email) {
        setAddRoleError('You need to be signed in to add advertiser access.');
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const res = await fetch('/api/advertiser/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          full_name: (prof as { full_name?: string } | null)?.full_name || '',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddRoleError(typeof body.error === 'string' ? body.error : 'Could not add advertiser access.');
        return;
      }
      setCanAdvertiserSave(true);
      setSubmitError('');
    } finally {
      setAddRoleBusy(false);
    }
  };

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="bg-white min-h-screen">
        <div style={{ backgroundColor: '#0f1f3d' }} className="py-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-wrap items-start justify-between gap-4">
            <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">Advertiser Portal</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
              Create New Ad
            </h1>
            </div>
            <button
              type="button"
              onClick={() => handleSignOut()}
              className="text-sm font-semibold px-4 py-2.5 border border-white/30 text-gray-300 hover:text-white rounded-sm transition-colors shrink-0 ml-auto sm:ml-0"
            >
              Sign Out
            </button>
          </div>
            <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center gap-2 mt-4">
              {([1, 2, 3] as Step[]).map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${step >= s ? 'bg-amber-500 text-white' : 'bg-white/20 text-gray-400'}`}>
                    {s}
                  </div>
                  <span className={`text-xs font-medium ${step >= s ? 'text-white' : 'text-gray-500'}`}>
                    {s === 1 ? 'Ad Content' : s === 2 ? 'Package' : 'Review & Pay'}
                  </span>
                  {s < 3 && <ChevronRight size={12} className="text-gray-500" />}
                </div>
              ))}
            </div>
          </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          {!canAdvertiserSave && (
            <div className="text-sm text-amber-950 bg-amber-50 border border-amber-200 rounded-sm px-4 py-3 mb-6 space-y-3" role="region">
              <p className="font-medium">{ADD_ADVERTISER_ROLE_MSG}</p>
              <p className="text-xs text-amber-900/90">
                You can apply access on this account without signing out, or{' '}
                <Link href="/advertise/register" className="font-semibold underline">
                  open the advertiser signup flow
                </Link>
                .
              </p>
              {addRoleError && (
                <p className="text-xs text-red-700" role="alert">
                  {addRoleError}
                </p>
              )}
              <button
                type="button"
                disabled={addRoleBusy}
                onClick={() => handleAddAdvertiserRole()}
                className="px-4 py-2 text-sm font-semibold rounded-sm text-white bg-gray-900 hover:bg-blue-900 disabled:opacity-60"
              >
                {addRoleBusy ? 'Adding…' : 'Add advertiser role to this account'}
              </button>
            </div>
          )}
          {(submitError === ADD_ADVERTISER_ROLE_MSG || submitError === NEED_LOGIN_ADVERTISER_MSG) && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-sm px-4 py-3 mb-6" role="alert">
              {submitError === NEED_LOGIN_ADVERTISER_MSG ? (
                <>
                  {NEED_LOGIN_ADVERTISER_MSG}{' '}
                  <Link href="/advertise/login" className="font-semibold underline">
                    Advertiser login
                  </Link>
                </>
              ) : (
                <>
                  {ADD_ADVERTISER_ROLE_MSG}{' '}
                  <button
                    type="button"
                    onClick={() => handleAddAdvertiserRole()}
                    className="font-semibold underline text-left"
                  >
                    Add advertiser role now
                  </button>
                </>
              )}
            </p>
          )}
          {/* Step 1: Content */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Company Name *</label>
                <input type="text" name="company_name" value={content.company_name} onChange={handleContentChange} required
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800"
                  placeholder="Acme Ltd" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Ad Title * <span className="normal-case font-normal text-gray-400">(max 60 characters)</span>
                </label>
                <input type="text" name="title" value={content.title} onChange={handleContentChange} maxLength={60} required
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800"
                  placeholder="Your headline here" />
                <p className="text-xs text-gray-400 mt-1">{content.title.length}/60</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Ad Copy * <span className="normal-case font-normal text-gray-400">(max 150 characters)</span>
                </label>
                <textarea name="copy" value={content.copy} onChange={handleContentChange} maxLength={150} required rows={3}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800 resize-none"
                  placeholder="Short, compelling description of your offer" />
                <p className="text-xs text-gray-400 mt-1">{content.copy.length}/150</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">Destination URL *</label>
                <input type="url" name="destination_url" value={content.destination_url} onChange={handleContentChange} required
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800"
                  placeholder="https://yourwebsite.com/landing" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Image <span className="normal-case font-normal text-gray-400">(JPG or PNG, max 2MB)</span>
                </label>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png" onChange={handleImageChange} className="hidden" />
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 rounded-sm hover:border-gray-500 transition-colors">
                  Choose image
                </button>
                {imagePreview && (
                  <div className="mt-3 w-48 h-28 overflow-hidden rounded-sm bg-gray-100">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
                  Video URL <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <input type="url" name="video_url" value={content.video_url} onChange={handleContentChange}
                  className="w-full border border-gray-300 rounded-sm px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-800"
                  placeholder="https://youtube.com/watch?v=..." />
              </div>
              <button onClick={proceedToStep2}
                className="w-full py-3 font-semibold text-sm rounded-sm transition-colors text-white"
                style={{ backgroundColor: '#0f1f3d' }}>
                Continue to Package Selection →
              </button>
            </div>
          )}

          {/* Step 2: Package */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                Select a Package
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {PACKAGES.map((pkg) => (
                  <button key={pkg.days} onClick={() => setSelectedPkg(pkg)}
                    className={`relative p-5 border rounded-sm text-left transition-all ${
                      selectedPkg?.days === pkg.days
                        ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400'
                        : 'border-gray-200 bg-white hover:border-gray-400'
                    }`}>
                    {pkg.popular && (
                      <span className="absolute -top-2.5 left-3 text-xs font-semibold uppercase tracking-widest bg-amber-500 text-white px-2 py-0.5 rounded-sm">
                        Popular
                      </span>
                    )}
                    <div className="flex items-end gap-1 mb-2">
                      <span className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>{pkg.price}</span>
                      <span className="text-xs text-gray-400 mb-0.5">/ {pkg.label}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{pkg.description}</p>
                    {selectedPkg?.days === pkg.days && (
                      <CheckCircle size={16} className="absolute top-3 right-3 text-amber-600" />
                    )}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="flex-1 py-3 border border-gray-300 font-semibold text-sm rounded-sm text-gray-700 hover:border-gray-500 transition-colors">
                  ← Back
                </button>
                <button onClick={proceedToStep3} disabled={!selectedPkg}
                  className="flex-1 py-3 font-semibold text-sm rounded-sm transition-colors text-white disabled:opacity-50"
                  style={{ backgroundColor: '#0f1f3d' }}>
                  Continue to Review →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Pay */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
                Review Your Ad
              </h2>

              <div className="bg-gray-50 border border-gray-200 rounded-sm p-6 mb-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Company</span>
                  <span className="font-medium text-gray-900">{content.company_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Title</span>
                  <span className="font-medium text-gray-900">{content.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Copy</span>
                  <span className="font-medium text-gray-900 max-w-xs text-right">{content.copy}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Destination</span>
                  <span className="font-medium text-gray-900 text-right break-all max-w-xs">{content.destination_url}</span>
                </div>
                {imagePreview && (
                  <div>
                    <span className="text-xs text-gray-500">Image preview</span>
                    <div className="mt-2 w-32 h-20 overflow-hidden rounded-sm bg-gray-100">
                      <img src={imagePreview} alt="Ad preview" className="w-full h-full object-cover" />
                    </div>
                  </div>
                )}
                <hr className="border-gray-200" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Package</span>
                  <span className="font-bold text-gray-900">{selectedPkg?.label} — {selectedPkg?.price}</span>
                </div>
              </div>

              {modError && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-sm mb-5">
                  <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">Ad rejected by content moderation</p>
                    <p className="text-sm text-red-700 mt-1">{modError}</p>
                    <p className="text-xs text-red-600 mt-2">If you believe this is an error, please contact <a href="mailto:support@groundviewnews.com" className="underline">support@groundviewnews.com</a>.</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={isProcessing}
                  className="flex-1 py-3 border border-gray-300 font-semibold text-sm rounded-sm text-gray-700 hover:border-gray-500 transition-colors disabled:opacity-50">
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => runModerationAndPay()}
                  disabled={isProcessing || !selectedPkg}
                  className="flex-1 py-3 font-semibold text-sm rounded-sm transition-colors text-white disabled:opacity-60"
                  style={{ backgroundColor: '#B8860B' }}>
                  {isProcessing ? 'Processing...' : 'Pay Now →'}
                </button>
              </div>
              {submitError && (
                <p className="text-sm text-red-600 mt-3" role="alert">
                  {submitError}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-3 text-center">
                Your ad will be reviewed for content compliance before payment is processed.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
