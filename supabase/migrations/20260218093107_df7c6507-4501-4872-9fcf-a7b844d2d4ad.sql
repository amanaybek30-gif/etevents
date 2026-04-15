
-- Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'organizer', 'staff');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Organizer profiles table
CREATE TABLE public.organizer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  organization_name text NOT NULL,
  phone text,
  payment_details text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can view own profile"
  ON public.organizer_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Organizers can insert own profile"
  ON public.organizer_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Organizers can update own profile"
  ON public.organizer_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow organizers to INSERT events
CREATE POLICY "Organizers can create events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'organizer') AND auth.uid() = organizer_id);

-- Allow organizers to UPDATE their own events
CREATE POLICY "Organizers can update own events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'organizer') AND auth.uid() = organizer_id);

-- Allow organizers to DELETE their own events
CREATE POLICY "Organizers can delete own events"
  ON public.events FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'organizer') AND auth.uid() = organizer_id);

-- Allow admins full access to events
CREATE POLICY "Admins can manage all events"
  ON public.events FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins full access to registrations
CREATE POLICY "Admins can manage all registrations"
  ON public.registrations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow organizers to view registrations for their events
CREATE POLICY "Organizers can view own event registrations"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'organizer') AND
    event_id IN (SELECT id FROM public.events WHERE organizer_id = auth.uid())
  );

-- Allow organizers to update registrations for their events (approve/reject/check-in)
CREATE POLICY "Organizers can update own event registrations"
  ON public.registrations FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'organizer') AND
    event_id IN (SELECT id FROM public.events WHERE organizer_id = auth.uid())
  );

-- Function to auto-assign organizer role on profile creation
CREATE OR REPLACE FUNCTION public.assign_organizer_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'organizer')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_organizer_profile_created
  AFTER INSERT ON public.organizer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_organizer_role();
