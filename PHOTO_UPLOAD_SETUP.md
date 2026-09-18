# Photo Upload Setup Guide

## Current Status
The photo upload feature has been implemented with:
- ✅ Error handling that returns actual Supabase error messages
- ✅ Authorization verification through user memberships
- ✅ Image compression (2MB → 400KB via browser-image-compression)
- ✅ Form UI for selecting and uploading photos

## Required Setup

### Create Supabase Storage Bucket

The photo upload endpoint requires a "menu-items" storage bucket. Follow these steps:

#### For Remote Supabase Project:
1. Go to your Supabase project dashboard
2. Navigate to **Storage** → **Buckets**
3. Click **"New bucket"**
4. Set name to `menu-items`
5. Toggle **"Public bucket"** ON (allows authenticated users to view photos)
6. Click **"Create bucket"**
7. (Optional) Under bucket policies, allow authenticated users to upload images

#### For Local Development:
The bucket is automatically created via `supabase/config.toml` configuration when you run:
```bash
supabase start
```

### RLS Policy (For Remote)
If your Supabase project uses RLS for storage, add this policy to the "menu-items" bucket:

```
Allowed operations: SELECT (download only)
For authenticated users
```

## Testing Photo Upload

1. Navigate to the menu editor
2. Select a section (e.g., "Beverages")
3. Click "Add Item"
4. Fill in item details (name, description, price)
5. Click the photo upload area or drag an image
6. Click "Save Item"

## Error Messages

After setup, you should see:
- **Success**: Item saved with photo path
- **Authorization error**: "Unauthorized" (user not a member of the organization)
- **Bucket error**: "Bucket not found" (bucket not created yet)
- **File size error**: "File exceeds 10MB limit"
- **Invalid MIME type**: "Invalid file type" (only PNG, JPEG, WebP supported)

## Photo Storage Path

Photos are stored at: `supabase-storage://menu-items/{venueId}/{timestamp}-{filename}`

Example: `menu-items/47a53f4f-bb41-495c/1735234567-coffee.png`
